// Kwest-koblingen for Claude (MCP-server).
// Claude kobler seg hit med lærerens egen Kwest-innlogging (OAuth via Supabase) og kan da lage,
// lese og endre lærerens kwest direkte. Alle databasekall går med lærerens egen nøkkel,
// så de vanlige tilgangsreglene i databasen gjelder akkurat som i Kwest Studio.
//
// Adresser (se vercel.json):
//   /mcp                                      – selve koblingen (JSON-RPC over HTTP POST)
//   /.well-known/oauth-protected-resource…    – forteller Claude hvor innloggingen skjer
//   /.well-known/oauth-authorization-server   – reserve for eldre klienter (videresender Supabase sin)
import { SUPABASE_URL, SUPABASE_KEY } from '../js/config.js';
import { normalizeQuestion, exportQuiz, validateQuiz, readTime, soundtrack, SOUNDTRACKS } from '../js/game.js';

const PROTOCOLS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const AUTH_SERVER = SUPABASE_URL.replace(/\/$/, '') + '/auth/v1';
const SCOPE = 'email';
const MAX_QUESTIONS = 100;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id',
};

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS, ...headers } });

function origin(req) {
  const u = new URL(req.url);
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || u.host;
  const proto = req.headers.get('x-forwarded-proto') || (/^(localhost|127\.)/.test(host) ? 'http' : 'https');
  return `${proto.split(',')[0]}://${host}`;
}

const resourceMetadataUrl = req => origin(req) + '/.well-known/oauth-protected-resource/mcp';

function protectedResourceMetadata(req) {
  return {
    resource: origin(req) + '/mcp',
    authorization_servers: [AUTH_SERVER],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ['header'],
    resource_name: 'Kwest',
    resource_documentation: origin(req) + '/koble',
  };
}

function unauthorized(req, error) {
  const parts = [`resource_metadata="${resourceMetadataUrl(req)}"`, `scope="${SCOPE}"`];
  if (error) parts.unshift(`error="${error}"`);
  return json({ error: error || 'unauthorized', error_description: 'Logg inn med Kwest-kontoen din.' }, 401, { 'WWW-Authenticate': 'Bearer ' + parts.join(', ') });
}

// ---------- Databasen (Supabase REST) med lærerens egen nøkkel ----------
class UserError extends Error {}

function db(token) {
  const headers = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  const call = async (path, init = {}) => {
    const res = await fetch(SUPABASE_URL + path, { ...init, headers: { ...headers, ...(init.headers || {}) } });
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const msg = body?.message || body?.msg || body?.error_description || res.statusText;
      const e = new Error(msg); e.status = res.status; throw e;
    }
    return body;
  };
  return {
    user: () => call('/auth/v1/user'),
    profile: id => call(`/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=name,approved`).then(r => r[0] || null),
    list: (filter) => call(`/rest/v1/quizzes?select=id,title,description,owner,question_count,updated_at,profiles(name,email)&order=updated_at.desc&limit=200${filter}`),
    get: id => call(`/rest/v1/quizzes?id=eq.${encodeURIComponent(id)}&select=*`).then(r => r[0] || null),
    insert: row => call('/rest/v1/quizzes?select=id', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) }).then(r => r[0]),
    update: (id, row) => call(`/rest/v1/quizzes?id=eq.${encodeURIComponent(id)}&select=id`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) }),
  };
}

// ---------- Verktøyene Claude får ----------
const GUIDE = `Kwest is a live classroom quiz app (like a game show: questions on the big screen, students answer on their phones).
Write questions in the language the teacher uses (Norwegian Bokmål by default) unless asked otherwise.
Good Kwest questions test understanding of the most important points, not random details. Wrong options must be plausible.
Keep question text short (preferably under 120 characters) and options under 60 characters, max 4 options.
Mostly use "quiz", plus some "truefalse", "short", "slider" and "order" where they fit; one "wordcloud" or "poll" works well as a warm-up.
Every question except "info" and "scoreboard" should have an "explanation": 1–3 sentences (max ~400 characters) on WHY the correct answer is correct, shown to students after they answer. For poll/wordcloud, give a short teaching point instead.
Use "points": "double" on 1–2 especially important questions.
After creating a Kwest, give the teacher the link so they can open it in Kwest Studio.`;

const QUESTION_SCHEMA = {
  type: 'object',
  description: 'One question/slide. Only the fields relevant for its type are used.',
  properties: {
    type: { type: 'string', enum: ['quiz', 'truefalse', 'short', 'poll', 'wordcloud', 'slider', 'order', 'info', 'scoreboard'],
      description: 'quiz = multiple choice (one or more correct); truefalse; short = students type a short answer; poll = opinion poll without right answer; wordcloud = students submit words; slider = guess a number on a scale; order = put items in the right order; info = plain text slide; scoreboard = show the leaderboard here.' },
    text: { type: 'string', description: 'The question (or the slide text for "info").' },
    explanation: { type: 'string', description: 'Why the correct answer is correct (1–3 sentences). Required for all types except info and scoreboard.' },
    time: { type: 'integer', minimum: 5, maximum: 240, description: 'Seconds to answer. Typical: quiz 20, truefalse 10, short/slider/order/wordcloud 30.' },
    points: { type: 'string', enum: ['standard', 'double', 'none'] },
    options: { type: 'array', maxItems: 4, description: 'quiz and poll: 2–4 answer options. For poll, omit "correct".',
      items: { type: 'object', properties: { text: { type: 'string' }, correct: { type: 'boolean' } }, required: ['text'] } },
    correct: { type: ['boolean', 'number'], description: 'truefalse: true/false. slider: the correct number.' },
    answers: { type: 'array', items: { type: 'string' }, description: 'short: every accepted answer/spelling (small typos are accepted automatically).' },
    min: { type: 'number', description: 'slider: lowest value.' },
    max: { type: 'number', description: 'slider: highest value.' },
    step: { type: 'number', description: 'slider: step size.' },
    tolerance: { type: 'number', description: 'slider: how far off still counts as correct.' },
    unit: { type: 'string', description: 'slider: unit shown after the number, e.g. "mg".' },
    items: { type: 'array', items: { type: 'string' }, maxItems: 4, description: 'order: 2–4 items listed in the CORRECT order (students see them shuffled).' },
    maxWords: { type: 'integer', minimum: 1, maximum: 3, description: 'wordcloud: words per student.' },
    image: { type: 'string', description: 'Optional https:// URL of an image to show with the question.' },
    explanationImage: { type: 'string', description: 'Optional https:// URL of an image shown large in the explanation after answering (e.g. a molecule, graph or diagram), with the explanation text below it.' },
    discuss: { type: 'boolean', description: 'quiz/truefalse/poll: let students discuss with a neighbour and vote again.' },
  },
  required: ['type', 'text'],
};

const SETTINGS_SCHEMA = {
  type: 'object', description: 'Game settings.',
  properties: {
    leaderboard: { type: 'boolean', description: 'Show the leaderboard between questions (default true).' },
    shuffle: { type: 'boolean', description: 'Shuffle answer options (default false).' },
    finale: { type: 'boolean', description: 'The last scored question counts double (default false).' },
    anonymous: { type: 'boolean', description: 'Students get random animal names instead of the names they type (default false). Only change if the teacher asks.' },
    readTime: { type: 'integer', minimum: 3, maximum: 20, description: 'Seconds the question is shown before students can answer (default 6). Use more for long questions.' },
    soundtrack: { type: 'string', enum: SOUNDTRACKS, description: 'Background music on the big screen: "whiteTiger" (Temple of the White Tiger: flute, temple drums; default), "jotunheimen" (Norwegian mountains: strings and horns in a romantic, Grieg-like style) or "none" (sound effects only). Only change if the teacher asks.' },
  },
};

const TOOLS = [
  {
    name: 'create_kwest',
    title: 'Lag kwest',
    description: 'Create a new Kwest (quiz) in the teacher\'s Kwest account and return a link to it. Use this when the teacher asks for a quiz/Kwest, e.g. based on an uploaded PowerPoint, PDF or article.\n\n' + GUIDE,
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short title.' },
        description: { type: 'string', description: 'One sentence about the topic.' },
        questions: { type: 'array', items: QUESTION_SCHEMA, minItems: 1, maxItems: MAX_QUESTIONS },
        settings: SETTINGS_SCHEMA,
        private: { type: 'boolean', description: 'true = only the teacher can see it (colleagues cannot). Default false.' },
      },
      required: ['title', 'questions'],
    },
    annotations: { title: 'Lag kwest', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: 'list_kwests',
    title: 'Vis mine kwest',
    description: 'List the teacher\'s own Kwests (newest first). Use it to find the id of an existing Kwest.',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Optional text to search for in the title.' },
        include_colleagues: { type: 'boolean', description: 'Also list Kwests shared by colleagues (read only). Default false.' },
      },
    },
    annotations: { title: 'Vis mine kwest', readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'get_kwest',
    title: 'Hent kwest',
    description: 'Get the full content of a Kwest (all questions), e.g. before improving or changing it.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'The Kwest id.' } }, required: ['id'] },
    annotations: { title: 'Hent kwest', readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'update_kwest',
    title: 'Endre kwest',
    description: 'Change one of the teacher\'s Kwests. Only the fields you send are changed. "questions" REPLACES all questions, so first call get_kwest and send the complete, edited list (keep image/audio fields you want to keep). To only add questions, use add_questions instead.\n\n' + GUIDE,
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        questions: { type: 'array', items: QUESTION_SCHEMA, minItems: 1, maxItems: MAX_QUESTIONS },
        settings: SETTINGS_SCHEMA,
        private: { type: 'boolean' },
      },
      required: ['id'],
    },
    annotations: { title: 'Endre kwest', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'add_questions',
    title: 'Legg til spørsmål',
    description: 'Add new questions to one of the teacher\'s existing Kwests, at the end or at a given position.\n\n' + GUIDE,
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        questions: { type: 'array', items: QUESTION_SCHEMA, minItems: 1, maxItems: MAX_QUESTIONS },
        position: { type: 'integer', minimum: 1, description: 'Optional: the new questions start at this question number (1 = first). Default: at the end.' },
      },
      required: ['id', 'questions'],
    },
    annotations: { title: 'Legg til spørsmål', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
];

const ISSUES = {
  'val.noText': 'has no question text',
  'val.twoOptions': 'needs at least 2 filled-in options',
  'val.noCorrect': 'has no correct option',
  'val.noAnswer': 'has no accepted answer',
  'val.twoItems': 'needs at least 2 items',
  'val.slider': 'has max lower than or equal to min',
};

// Bilder/lyd bare som vanlige nettadresser (ikke innebygde data), og en fornuftig grense på størrelsen.
function cleanQuestions(list) {
  if (!Array.isArray(list) || !list.length) throw new UserError('"questions" must be a non-empty list.');
  if (list.length > MAX_QUESTIONS) throw new UserError(`A Kwest can have at most ${MAX_QUESTIONS} questions.`);
  const qs = list.map(q => normalizeQuestion(q)).filter(Boolean);
  for (const q of qs) {
    if (q.image && !q.image.startsWith('https://')) q.image = '';
    if (q.audio && !q.audio.startsWith('https://')) q.audio = '';
    if (q.explanationImage && !q.explanationImage.startsWith('https://')) q.explanationImage = '';
    if (q.time && q.time < 5 && q.type !== 'info' && q.type !== 'scoreboard') q.time = 5;
  }
  if (!qs.length) throw new UserError('No valid questions.');
  return qs;
}

const cleanSettings = (s, base = {}) => ({
  leaderboard: s?.leaderboard ?? base.leaderboard ?? true,
  shuffle: !!(s?.shuffle ?? base.shuffle),
  finale: !!(s?.finale ?? base.finale),
  anonymous: !!(s?.anonymous ?? base.anonymous),
  readTime: readTime({ readTime: s?.readTime ?? base.readTime }),
  soundtrack: soundtrack({ soundtrack: s?.soundtrack ?? base.soundtrack }),
});

function summary(quiz, link) {
  const issues = validateQuiz(quiz).map(i => `- Question ${i.index + 1} ${ISSUES[i.key] || i.key}`);
  const missingExp = quiz.questions
    .map((q, i) => (!q.explanation && !['info', 'scoreboard'].includes(q.type) ? i + 1 : 0)).filter(Boolean);
  const lines = [`Saved "${quiz.title}" with ${quiz.questions.length} questions.`, `Open in Kwest Studio: ${link}`];
  if (issues.length) lines.push('', 'Problems that must be fixed before it can be played (use update_kwest):', ...issues);
  if (missingExp.length) lines.push('', `Missing explanation on question ${missingExp.join(', ')}.`);
  lines.push('', 'Tell the teacher the link. They can start the game from Kwest Studio.');
  return lines.join('\n');
}

const text = (s, isError = false) => ({ content: [{ type: 'text', text: s }], ...(isError ? { isError: true } : {}) });
const studioLink = (req, id) => `${origin(req)}/studio.html#/rediger/${id}`;
const isUuid = s => typeof s === 'string' && /^[0-9a-f-]{36}$/i.test(s);

async function loadOwn(api, user, id) {
  if (!isUuid(id)) throw new UserError('Unknown Kwest id. Use list_kwests to find it.');
  const row = await api.get(id);
  if (!row) throw new UserError('Found no Kwest with that id (or the teacher does not have access to it).');
  if (row.owner !== user.id) throw new UserError('This Kwest belongs to a colleague and cannot be changed. Create a copy with create_kwest instead.');
  return row;
}

function toQuiz(row) {
  return {
    title: row.title,
    description: row.description || '',
    settings: cleanSettings(row.data?.settings),
    questions: Array.isArray(row.data?.questions) ? row.data.questions : [],
  };
}

async function saveRow(api, id, row, quiz, extra = {}) {
  const data = { ...(row?.data || {}), settings: quiz.settings, questions: quiz.questions };
  const patch = { title: quiz.title, description: quiz.description, data, question_count: quiz.questions.length, updated_at: new Date().toISOString(), ...extra };
  if (!id) return api.insert(patch);
  const res = await api.update(id, patch);
  if (!res?.length) throw new UserError('The Kwest could not be saved (no access).');
  return res[0];
}

async function callTool(name, args, ctx) {
  const { api, user, req } = ctx;
  args ||= {};
  if (name === 'create_kwest') {
    const quiz = {
      title: String(args.title || '').trim().slice(0, 200) || 'Kwest',
      description: String(args.description || '').trim().slice(0, 1000),
      settings: cleanSettings(args.settings),
      questions: cleanQuestions(args.questions),
    };
    const extra = args.private !== undefined ? { is_private: !!args.private } : {};
    const saved = await saveRow(api, null, null, quiz, extra);
    return text(summary(quiz, studioLink(req, saved.id)) + `\n\nKwest id: ${saved.id}`);
  }
  if (name === 'list_kwests') {
    let filter = args.include_colleagues ? '' : `&owner=eq.${user.id}`;
    const s = String(args.search || '').replace(/[%*,()]/g, ' ').trim();
    if (s) filter += `&title=ilike.*${encodeURIComponent(s)}*`;
    const rows = await api.list(filter);
    if (!rows.length) return text(s ? `No Kwests with "${s}" in the title.` : 'The teacher has no Kwests yet.');
    return text(rows.map(r => {
      const who = r.owner === user.id ? '' : ` – by ${r.profiles?.name || r.profiles?.email || 'a colleague'} (read only)`;
      return `- ${r.title || '(untitled)'} (${r.question_count} questions, updated ${String(r.updated_at).slice(0, 10)})${who}\n  id: ${r.id}`;
    }).join('\n'));
  }
  if (name === 'get_kwest') {
    if (!isUuid(args.id)) throw new UserError('Unknown Kwest id. Use list_kwests to find it.');
    const row = await api.get(args.id);
    if (!row) throw new UserError('Found no Kwest with that id (or the teacher does not have access to it).');
    const out = { id: row.id, ...exportQuiz(toQuiz(row)), mine: row.owner === user.id, private: !!row.is_private, link: studioLink(req, row.id) };
    delete out.kwest;
    return text(JSON.stringify(out, null, 1));
  }
  if (name === 'update_kwest') {
    const row = await loadOwn(api, user, args.id);
    const quiz = toQuiz(row);
    if (args.title !== undefined) quiz.title = String(args.title).trim().slice(0, 200) || quiz.title;
    if (args.description !== undefined) quiz.description = String(args.description).trim().slice(0, 1000);
    if (args.settings) quiz.settings = cleanSettings(args.settings, quiz.settings);
    if (args.questions !== undefined) quiz.questions = cleanQuestions(args.questions);
    const extra = args.private !== undefined ? { is_private: !!args.private } : {};
    await saveRow(api, row.id, row, quiz, extra);
    return text(summary(quiz, studioLink(req, row.id)));
  }
  if (name === 'add_questions') {
    const row = await loadOwn(api, user, args.id);
    const quiz = toQuiz(row);
    const add = cleanQuestions(args.questions);
    if (quiz.questions.length + add.length > MAX_QUESTIONS) throw new UserError(`A Kwest can have at most ${MAX_QUESTIONS} questions.`);
    const at = Number.isInteger(args.position) ? Math.max(0, Math.min(quiz.questions.length, args.position - 1)) : quiz.questions.length;
    quiz.questions.splice(at, 0, ...add);
    await saveRow(api, row.id, row, quiz);
    return text(summary(quiz, studioLink(req, row.id)));
  }
  throw new UserError('Unknown tool: ' + name);
}

// ---------- JSON-RPC ----------
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

async function handleMessage(msg, ctx) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return msg && 'id' in msg && !('method' in msg) ? null : rpcError(msg?.id, -32600, 'Invalid request');
  }
  const { id, method, params } = msg;
  if (id === undefined) return null; // varsel (notification) – ingen svar
  const ok = result => ({ jsonrpc: '2.0', id, result });
  switch (method) {
    case 'initialize': {
      const asked = params?.protocolVersion;
      return ok({
        protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'kwest', title: 'Kwest', version: '1.0.0', websiteUrl: origin(ctx.req) },
        instructions: GUIDE,
      });
    }
    case 'ping': return ok({});
    case 'tools/list': return ok({ tools: TOOLS });
    case 'tools/call': {
      const name = params?.name;
      if (!TOOLS.some(t => t.name === name)) return rpcError(id, -32602, 'Unknown tool: ' + name);
      try {
        return ok(await callTool(name, params.arguments, ctx));
      } catch (e) {
        if (e instanceof UserError) return ok(text(e.message, true));
        if (e.status === 401) throw e;
        if (e.status === 403 || /row-level security/i.test(e.message)) {
          return ok(text('Kwest refused the change. The teacher\'s account may not be approved yet by a Kwest administrator.', true));
        }
        if (/no-questions|no-json/.test(e.message)) return ok(text('No valid questions.', true));
        console.error('Kwest MCP-feil:', e);
        return ok(text('Something went wrong in Kwest: ' + e.message, true));
      }
    }
    case 'resources/list': return ok({ resources: [] });
    case 'prompts/list': return ok({ prompts: [] });
    default: return rpcError(id, -32601, 'Method not found: ' + method);
  }
}

export async function handle(req) {
  const url = new URL(req.url);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  // Metadata som forteller Claude hvordan innloggingen fungerer.
  const wk = url.searchParams.get('wk');
  if (wk === 'prm') return json(protectedResourceMetadata(req), 200, { 'Cache-Control': 'public, max-age=300' });
  if (wk === 'as') {
    const r = await fetch(SUPABASE_URL + '/.well-known/oauth-authorization-server/auth/v1');
    return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Bruk POST. Dette er Kwest-koblingen for Claude – se ' + origin(req) + '/koble' }, 405, { Allow: 'POST, OPTIONS' });
  }

  const auth = req.headers.get('authorization') || '';
  const token = /^Bearer\s+(.+)$/i.exec(auth)?.[1]?.trim();
  if (!token) return unauthorized(req);
  const api = db(token);
  let user;
  try { user = await api.user(); } catch (e) { return e.status >= 500 ? json({ error: 'Kwest er ikke tilgjengelig akkurat nå.' }, 503) : unauthorized(req, 'invalid_token'); }
  if (!user?.id) return unauthorized(req, 'invalid_token');

  let body;
  try { body = await req.json(); } catch { return json(rpcError(null, -32700, 'Parse error'), 400); }
  const ctx = { api, user, req };
  try {
    if (Array.isArray(body)) {
      const out = (await Promise.all(body.map(m => handleMessage(m, ctx)))).filter(Boolean);
      return out.length ? json(out) : new Response(null, { status: 202, headers: CORS });
    }
    const out = await handleMessage(body, ctx);
    return out ? json(out) : new Response(null, { status: 202, headers: CORS });
  } catch (e) {
    if (e.status === 401) return unauthorized(req, 'invalid_token');
    throw e;
  }
}

export default { fetch: handle };
