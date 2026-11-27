// Tester Kwest-koblingen for Claude (api/mcp.js) mot en falsk database i minnet.
// Ingenting sendes til den ekte databasen. Kjør: node tests/mcp.mjs
import assert from 'node:assert/strict';
import { SUPABASE_URL } from '../js/config.js';

const users = { 'tok-anna': { id: '11111111-1111-1111-1111-111111111111', email: 'anna@skole.no' }, 'tok-bo': { id: '22222222-2222-2222-2222-222222222222', email: 'bo@skole.no' } };
const rows = [];
let nextId = 1;
const newId = () => `aaaaaaaa-0000-0000-0000-${String(nextId++).padStart(12, '0')}`;

// Falsk Supabase: bare det koblingen bruker.
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  if (!url.href.startsWith(SUPABASE_URL)) throw new Error('Uventet nettverkskall: ' + url.href);
  const token = (init.headers?.Authorization || '').replace('Bearer ', '');
  const user = users[token];
  const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });
  if (url.pathname === '/auth/v1/user') return user ? reply(user) : reply({ msg: 'invalid JWT' }, 401);
  if (!user) return reply({ message: 'JWT expired' }, 401);
  const eq = k => url.searchParams.get(k)?.replace(/^eq\./, '');
  if (url.pathname === '/rest/v1/profiles') return reply([{ name: 'Anna', approved: true }]);
  if (url.pathname === '/rest/v1/quizzes') {
    const method = init.method || 'GET';
    if (method === 'POST') {
      const row = { id: newId(), owner: user.id, created_at: new Date().toISOString(), ...JSON.parse(init.body) };
      rows.push(row);
      return reply([{ id: row.id }], 201);
    }
    if (method === 'PATCH') {
      const row = rows.find(r => r.id === eq('id') && r.owner === user.id); // som tilgangsreglene i databasen
      if (row) Object.assign(row, JSON.parse(init.body));
      return reply(row ? [{ id: row.id }] : []);
    }
    let list = rows.filter(r => !r.is_private || r.owner === user.id);
    if (eq('id')) list = list.filter(r => r.id === eq('id'));
    if (eq('owner')) list = list.filter(r => r.owner === eq('owner'));
    const like = url.searchParams.get('title')?.replace(/^ilike\.\*|\*$/g, '');
    if (like) list = list.filter(r => r.title.toLowerCase().includes(like.toLowerCase()));
    return reply(list.map(r => ({ ...r, profiles: { name: r.owner === users['tok-anna'].id ? 'Anna' : 'Bo' } })));
  }
  return reply({ message: 'not found' }, 404);
};

const { handle } = await import('../api/mcp.js');
const BASE = 'https://kwest.test';
let rpcId = 0;
const post = (body, token = 'tok-anna') => handle(new Request(BASE + '/api/mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', host: 'kwest.test', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body),
}));
const rpc = async (method, params, token) => (await (await post({ jsonrpc: '2.0', id: ++rpcId, method, params }, token)).json());
const call = async (name, args, token) => (await rpc('tools/call', { name, arguments: args }, token)).result;
const step = msg => console.log('•', msg);

// 1. Uten innlogging: 401 som peker Claude til innloggingen.
let res = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }, null);
assert.equal(res.status, 401);
assert.match(res.headers.get('www-authenticate'), /^Bearer .*resource_metadata="https:\/\/kwest\.test\/\.well-known\/oauth-protected-resource\/mcp"/);
res = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }, 'feil');
assert.equal(res.status, 401);
assert.match(res.headers.get('www-authenticate'), /error="invalid_token"/);
step('Uten gyldig innlogging får Claude beskjed om å logge inn');

res = await handle(new Request(BASE + '/api/mcp?wk=prm', { headers: { host: 'kwest.test' } }));
const prm = await res.json();
assert.equal(prm.resource, 'https://kwest.test/mcp');
assert.deepEqual(prm.authorization_servers, [SUPABASE_URL + '/auth/v1']);
step('Innloggingsinformasjonen peker til Supabase');

res = await handle(new Request(BASE + '/api/mcp', { headers: { host: 'kwest.test' } }));
assert.equal(res.status, 405);

// 2. Oppstart
const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
assert.equal(init.result.protocolVersion, '2025-06-18');
assert.ok(init.result.capabilities.tools);
assert.equal((await rpc('initialize', { protocolVersion: '1999-01-01' })).result.protocolVersion, '2025-11-25');
res = await post({ jsonrpc: '2.0', method: 'notifications/initialized' });
assert.equal(res.status, 202);
const tools = (await rpc('tools/list')).result.tools;
assert.deepEqual(tools.map(t => t.name), ['create_kwest', 'list_kwests', 'get_kwest', 'update_kwest', 'add_questions']);
for (const t of tools) assert.equal(t.inputSchema.type, 'object');
assert.equal((await rpc('nope')).error.code, -32601);
step('Oppstart og verktøyliste virker');

// 3. Lag et kwest slik Claude ville gjort det
let r = await call('create_kwest', {
  title: 'Antibiotika', description: 'Grunnleggende',
  questions: [
    { type: 'quiz', text: 'Hvilket middel er et betalaktam?', explanation: 'Penicillin har betalaktamring.', points: 'double', options: [{ text: 'Penicillin', correct: true }, { text: 'Doksysyklin' }, { text: 'Gentamicin' }] },
    { type: 'truefalse', text: 'Vankomycin virker på gramnegative.', correct: false, explanation: 'Den er for stor til å passere yttermembranen.' },
    { type: 'slider', text: 'Hvor mange gram?', min: 0, max: 10, correct: 3, tolerance: 1, unit: 'g', explanation: 'Tre.' },
    { type: 'order', text: 'Sorter', items: ['a', 'b', 'c'], explanation: 'Slik.' },
    { type: 'short', text: 'Hva heter enzymet?', answers: ['betalaktamase'], explanation: 'Det bryter ringen.' },
    { type: 'poll', text: 'Hvor trygg er du?', options: [{ text: 'Veldig' }, { text: 'Litt' }], explanation: 'Fint å vite.' },
    { type: 'info', text: 'Pause', image: 'data:image/png;base64,AAAA' },
  ],
  settings: { finale: true },
});
assert.ok(!r.isError, r.content[0].text);
assert.match(r.content[0].text, /Saved "Antibiotika" with 7 questions/);
assert.match(r.content[0].text, /https:\/\/kwest\.test\/studio\.html#\/rediger\/aaaaaaaa-/);
assert.doesNotMatch(r.content[0].text, /Problems/);
const saved = rows[0];
assert.equal(saved.owner, users['tok-anna'].id);
assert.equal(saved.question_count, 7);
assert.equal(saved.data.settings.finale, true);
assert.equal(saved.data.settings.leaderboard, true);
assert.equal(saved.data.questions[0].points, 'double');
assert.equal(saved.data.questions[1].tf, false);
assert.equal(saved.data.questions[2].correct, 3);
assert.equal(saved.data.questions[6].image, '', 'innebygde bilder tas ikke imot');
assert.ok(saved.data.questions.every(q => q.id), 'alle spørsmål har id');
step('Claude kan lage et kwest, og det lagres riktig hos læreren');

// Feil i spørsmålene rapporteres tilbake til Claude
r = await call('create_kwest', { title: 'Uferdig', questions: [{ type: 'quiz', text: 'Mangler fasit', options: [{ text: 'a' }, { text: 'b' }] }] });
assert.match(r.content[0].text, /Question 1 has no correct option/);
assert.match(r.content[0].text, /Missing explanation on question 1/);
r = await call('create_kwest', { title: 'Tomt', questions: [] });
assert.equal(r.isError, true);
step('Mangler og feil meldes tilbake til Claude');

// 4. Finn, les og endre
r = await call('list_kwests', { search: 'antibio' });
assert.match(r.content[0].text, /Antibiotika \(7 questions/);
assert.doesNotMatch(r.content[0].text, /Uferdig/);
const id = saved.id;
r = await call('get_kwest', { id });
const got = JSON.parse(r.content[0].text);
assert.equal(got.questions.length, 7);
assert.equal(got.questions[0].id, undefined);
assert.equal(got.mine, true);

r = await call('add_questions', { id, position: 1, questions: [{ type: 'wordcloud', text: 'Hva tenker du på?', explanation: 'Oppvarming.' }] });
assert.match(r.content[0].text, /with 8 questions/);
assert.equal(saved.data.questions[0].type, 'wordcloud');
assert.equal(saved.question_count, 8);

got.questions[0].text = 'Hvilket middel er et betalaktam-antibiotikum?';
r = await call('update_kwest', { id, title: 'Antibiotika 2', questions: got.questions, settings: { shuffle: true, readTime: 10 } });
assert.ok(!r.isError, r.content[0].text);
assert.equal(saved.title, 'Antibiotika 2');
assert.equal(saved.question_count, 7);
assert.equal(saved.data.questions[0].text, 'Hvilket middel er et betalaktam-antibiotikum?');
assert.deepEqual(saved.data.settings, { leaderboard: true, shuffle: true, finale: true, anonymous: false, readTime: 10, soundtrack: 'whiteTiger' });
step('Claude kan finne, lese, utvide og endre kwestet');

// 5. En kollega kan se, men ikke endre
r = await call('list_kwests', {}, 'tok-bo');
assert.match(r.content[0].text, /no Kwests yet/);
r = await call('list_kwests', { include_colleagues: true }, 'tok-bo');
assert.match(r.content[0].text, /by Anna \(read only\)/);
r = await call('update_kwest', { id, title: 'Kapret' }, 'tok-bo');
assert.equal(r.isError, true);
assert.equal(saved.title, 'Antibiotika 2');
r = await call('get_kwest', { id: 'ikke-en-id' });
assert.equal(r.isError, true);
step('Andre lærere kan ikke endre kwestet');

console.log('OK – koblingen for Claude virker');
