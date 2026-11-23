// Storskjermen: læreren starter spillet, viser spørsmål, resultater og pallen.
import { h, svg, clear, qs, makePin, shuffle, baseUrl, normText, confirmBox, toast } from './util.js';
import { t, langButton } from './i18n.js';
import { backend } from './backend.js';
import { COLORS, SHAPES, SCORED, DISCUSS_TYPES, TEAM_COLORS, REACTIONS, finaleIndex, colorIndex, playable, judge, speedPoints, basePoints } from './game.js';
import { icon } from './icons.js';
import { wordmark, exclamationSvg, questionSvg, setFavicon } from './logo.js';

setFavicon();
const app = document.getElementById('app');
const quizId = qs('id');
// Prøvekjøring: fem testelever svarer tilfeldig, ingen kan bli med og ingenting sendes ut.
const TEST = qs('test') === '1';
const STORE = (TEST ? 'kwest-test-' : 'kwest-host-') + quizId;
const BOTS = ['Bot Bjørn', 'Bot Berit', 'Bot Bendik', 'Bot Bodil', 'Bot Brage'];
const INTRO_MS = 3000;

let quiz = null;
let ch = null;
let inn = null;
let rosterTimer = null;
let allInTimer = null;
const rosterQueue = {};
let tick = null;
let introTimer = null;
const shownChips = new Set();

const G = {
  pin: null, phase: 'lobby', qi: -1, locked: false,
  players: {}, // id -> { name, score, streak, ok, pts, answered, joinedAt, climb }
  answers: {}, // id -> { value, t }
  map: null, labels: null, qStart: 0, hidden: [],
  teams: 0, teamOf: {}, // antall lag (0 = uten lag) og hvilket lag hver elev er på
  reactions: true,
  round: 1, first: null, firstN: 0, discussNow: false, // «diskuter og stem igjen»
  climber: null, // { id, n } største klatrer på siste spørsmål
};
let reviewAt = -1; // gjennomgang av de vanskeligste spørsmålene etter pallen

// Spørsmål nr. i klart for spilling (finalen får dobbel poeng).
function qAt(i) {
  const c = playable(quiz.questions[i]);
  if (i === finaleIndex(quiz)) c.points = 'double';
  return c;
}
function q() { return quiz && G.qi >= 0 ? qAt(G.qi) : null; }
function isFinale() { return G.qi >= 0 && G.qi === finaleIndex(quiz); }
function canDiscuss(cur) { return DISCUSS_TYPES.includes(cur.type); }
function teamName(i) { return t('team.' + i); }
function total() { return quiz.questions.length; }
function playerIds() { return Object.keys(G.players).sort((a, b) => G.players[a].joinedAt - G.players[b].joinedAt); }
function persist() { try { sessionStorage.setItem(STORE, JSON.stringify(G)); } catch { /* fullt */ } }

// ---------- Oppstart ----------
async function init() {
  if (backend.mode === 'demo') { document.body.classList.add('is-demo'); document.body.append(h('div', { class: 'demo-banner' }, t('demo.banner'))); }
  center(h('div', { class: 'spinner' }), t('host.loading'));
  const sess = await backend.session().catch(() => null);
  if (!sess?.profile?.approved) return center(exclamationSvg(80), t('host.loginFirst'), h('a', { class: 'btn primary', href: 'studio.html' }, t('auth.login')));
  try {
    const row = await backend.getQuiz(quizId);
    quiz = row.data;
    quiz.title = row.title;
  } catch {
    return center(exclamationSvg(80), t('host.notFound'), h('a', { class: 'btn', href: 'studio.html' }, t('host.back')));
  }
  if (!quiz.questions?.length) return center(exclamationSvg(80), t('host.notFound'));

  let restored = false;
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE));
    if (saved && saved.pin && saved.phase !== 'podium') { Object.assign(G, saved); restored = true; }
  } catch { /* ignorer */ }
  if (!G.pin) G.pin = makePin();

  // To kanaler: «ut» (læreren → alle elever) og «inn» (elever → bare læreren).
  if (TEST) {
    if (!restored) BOTS.forEach((name, i) => onJoin({ id: 'bot' + i, name }));
    setInterval(botReact, 2500);
    if (restored && G.phase === 'question') { startTicker(); botsAnswer(); }
    render();
    persist();
    return;
  }
  ch = backend.channel(G.pin);
  inn = backend.channel(G.pin + '-inn');
  inn.on('join', onJoin);
  inn.on('answer', onAnswer);
  inn.on('react', onReact);
  await Promise.all([ch.subscribe(), inn.subscribe()]);
  if (restored) {
    toast(t('host.restore'));
    if (G.phase === 'question') {
      const left = G.qStart + q().time * 1000 - Date.now();
      if (left <= 0) return reveal();
      startTicker();
    }
    if (G.phase === 'intro') return startQuestion();
    broadcast();
  }
  render();
  persist();
}

function put(el, ...children) {
  el.append(...children.flat().filter(c => c !== null && c !== undefined && c !== false));
}

function center(...children) {
  clear(app);
  app.append(h('div', { class: 'host-center' }, children));
}

// ---------- Meldinger fra elevene ----------
function onJoin(p) {
  const id = String(p.id || '');
  const name = String(p.name || '').replace(/\s+/g, ' ').trim().slice(0, 15);
  if (!id || !name) return;
  const existing = G.players[id];
  if (existing) return reply(id, { ok: true, score: existing.score, answered: !!G.answers[id] });
  if (G.locked) return reply(id, { ok: false, error: 'locked' });
  if (Object.values(G.players).some(pl => pl.name.toLowerCase() === name.toLowerCase())) return reply(id, { ok: false, error: 'taken' });
  G.players[id] = { name, score: 0, streak: 0, ok: null, pts: 0, answered: false, joinedAt: Date.now(), history: {} };
  if (G.teams) G.teamOf[id] = smallestTeam();
  reply(id, { ok: true, score: 0 });
  persist();
  if (G.phase === 'lobby') renderLobby(); else updateCount();
}

// Alt som går fra storskjermen til mobilene samles i én melding, maks omtrent én gang i sekundet.
// Hver melding leveres til alle elevene, så dette holder oss trygt under Supabase sin grense
// (100 meldinger i sekundet på gratisplanen) også med 50–60 elever.
const OUT_GAP = 1100;      // minste avstand mellom meldinger til alle
const JOIN_BATCH = 2000;   // svar på «bli med» samles i opptil 2 sekunder
let lastOut = 0, outAt = 0, statePending = false;

function reply(id, r) {
  rosterQueue[id] = r;
  scheduleOut(Math.max(lastOut + JOIN_BATCH, Date.now() + 600));
}

function broadcast() {
  statePending = true;
  scheduleOut(Math.max(lastOut + OUT_GAP, Date.now()));
}

function scheduleOut(at) {
  if (rosterTimer && outAt <= at) return;
  clearTimeout(rosterTimer);
  outAt = at;
  rosterTimer = setTimeout(flushOut, Math.max(0, at - Date.now()));
}

function flushOut() {
  rosterTimer = null;
  const replies = { ...rosterQueue };
  for (const k of Object.keys(rosterQueue)) delete rosterQueue[k];
  if (!statePending && !Object.keys(replies).length) return;
  statePending = false;
  lastOut = Date.now();
  ch?.send('state', { ...statePayload(), replies });
}

function onAnswer(p) {
  if (G.phase !== 'question' || p.qi !== G.qi || (p.round || 1) !== G.round || !G.players[p.id] || G.answers[p.id]) return;
  G.answers[p.id] = { value: p.value, t: Date.now() - G.qStart };
  persist();
  updateCount();
  // Alle har svart: vent litt før fasit, så meldingene ikke kommer i samme sekund.
  if (Object.keys(G.answers).length >= Object.keys(G.players).length && !allInTimer) allInTimer = setTimeout(reveal, 1200);
}

function kick(id) {
  delete G.players[id];
  delete G.answers[id];
  delete G.teamOf[id];
  ch?.send('kick', { id });
  persist();
  render();
}

// ---------- Lag ----------
function smallestTeam() {
  const counts = Array(G.teams).fill(0);
  Object.keys(G.players).forEach(id => { if (G.teamOf[id] !== undefined && counts[G.teamOf[id]] !== undefined) counts[G.teamOf[id]]++; });
  const min = Math.min(...counts);
  const options = counts.map((c, i) => (c === min ? i : -1)).filter(i => i >= 0);
  return options[Math.floor(Math.random() * options.length)];
}
function setTeams(n) {
  G.teams = n;
  G.teamOf = {};
  if (n) shuffle(Object.keys(G.players)).forEach((id, i) => { G.teamOf[id] = i % n; });
  persist();
  broadcast();
  render();
}
// Lagene rangert etter snittpoeng (så ulike store lag blir rettferdig).
function rankedTeams() {
  if (!G.teams) return [];
  const list = [...Array(G.teams).keys()].map(i => {
    const ids = Object.keys(G.players).filter(id => G.teamOf[id] === i);
    const avg = f => (ids.length ? Math.round(ids.reduce((s, id) => s + f(G.players[id]), 0) / ids.length) : 0);
    return { team: i, name: teamName(i), color: TEAM_COLORS[i], size: ids.length, score: avg(p => p.score), pts: avg(p => p.pts || 0), streak: 0 };
  }).filter(x => x.size);
  list.sort((a, b) => b.score - a.score);
  let rank = 0, last = null;
  list.forEach((x, i) => { if (x.score !== last) { rank = i + 1; last = x.score; } x.rank = rank; });
  return list;
}

// ---------- Reaksjoner (🐐 og ⛰️) ----------
const REACT_PHASES = ['lobby', 'reveal', 'scoreboard', 'podium', 'discuss'];
const lastReact = {};
let floating = 0;
function onReact(p) {
  const id = String(p.id || '');
  if (!G.reactions || !G.players[id] || !REACT_PHASES.includes(G.phase)) return;
  const now = Date.now();
  if (now - (lastReact[id] || 0) < 6000) return; // mobilen sender høyst hvert 8. sekund
  lastReact[id] = now;
  for (const [k, emoji] of Object.entries(REACTIONS)) {
    const n = Math.max(0, Math.min(5, Math.round(Number(p[k]) || 0)));
    for (let i = 0; i < n; i++) setTimeout(() => floatEmoji(emoji), i * 180 + Math.random() * 300);
  }
}
function floatEmoji(emoji) {
  if (floating > 40 || !G.reactions) return;
  floating++;
  const el = h('span', { class: 'react-float', 'aria-hidden': 'true', style: { left: (4 + Math.random() * 92) + '%', '--drift': (Math.random() * 80 - 40) + 'px', '--dur': (2.6 + Math.random() * 1.4) + 's', fontSize: (2 + Math.random() * 1.6) + 'rem' } }, emoji);
  document.body.append(el);
  setTimeout(() => { el.remove(); floating--; }, 4200);
}
function toggleReactions() {
  G.reactions = !G.reactions;
  persist();
  broadcast();
  render();
}

// ---------- Status som sendes til mobilene ----------
function ranked() {
  const ids = playerIds().sort((a, b) => G.players[b].score - G.players[a].score);
  let rank = 0, last = null;
  return ids.map((id, i) => {
    const pl = G.players[id];
    if (pl.score !== last) { rank = i + 1; last = pl.score; }
    return { id, rank, ...pl };
  });
}

function statePayload() {
  const st = { phase: G.phase, qi: G.qi, total: quiz ? total() : 0, round: G.round, rx: G.reactions };
  if (G.teams) st.teams = { n: G.teams, of: G.teamOf };
  const cur = q();
  const qInfo = () => ({ type: cur.type, labels: G.labels, maxWords: cur.maxWords, min: cur.min, max: cur.max, step: cur.step, unit: cur.unit, finale: isFinale() || undefined });
  if (G.phase === 'intro' && cur) {
    st.startsIn = Math.max(0, (G.introEnd || 0) - Date.now());
    st.remaining = cur.time * 1000;
    st.q = qInfo();
  }
  if (G.phase === 'question' && cur) {
    st.remaining = Math.max(0, G.qStart + cur.time * 1000 - Date.now());
    st.q = qInfo();
  }
  if (G.phase === 'discuss' && cur) st.q = { type: cur.type, labels: G.labels };
  if (['reveal', 'scoreboard', 'podium'].includes(G.phase)) {
    st.q = cur ? { type: cur.type, scored: SCORED.includes(cur.type) } : null;
    // Forklaring og fasit sendes bare med i fasit-visningen (ikke på poengtavle/pallen).
    if (G.phase === 'reveal' && cur) {
      const exp = (cur.explanation || '').trim();
      if (exp) st.q.explanation = exp;
      Object.assign(st.q, correctAnswer(cur));
    }
    st.results = {};
    const teamRank = {};
    rankedTeams().forEach(x => { teamRank[x.team] = x.rank; });
    for (const r of ranked()) {
      const res = st.results[r.id] = { ok: r.ok, pts: r.pts, score: r.score, rank: r.rank, streak: r.streak, answered: r.answered };
      if (r.climb >= 2 && G.phase === 'reveal') res.climb = r.climb;
      if (G.teams) res.tr = teamRank[G.teamOf[r.id]];
    }
  }
  return st;
}


// ---------- Gangen i spillet ----------
function next() {
  if (G.phase === 'lobby') return goTo(0);
  if (G.phase === 'question') return reveal();
  if (G.phase === 'discuss') return revote();
  const last = G.qi >= total() - 1;
  const nextIsBoard = !last && quiz.questions[G.qi + 1]?.type === 'scoreboard';
  if (G.phase === 'reveal' && quiz.settings?.leaderboard !== false && !last && !nextIsBoard && SCORED.includes(q().type) && playerIds().length) {
    G.phase = 'scoreboard';
    return commit(false); // mobilene viser allerede plasseringen sin
  }
  if (G.phase === 'reveal' || G.phase === 'scoreboard' || G.phase === 'info') {
    return last ? podium() : goTo(G.qi + 1);
  }
}

function goTo(i) {
  clearInterval(tick);
  clearTimeout(introTimer);
  G.qi = i;
  G.answers = {};
  G.hidden = [];
  G.round = 1; G.first = null; G.firstN = 0; G.discussNow = false;
  const cur = q();
  if (cur.type === 'info') { G.phase = 'info'; return commit(); }
  // Egen poengtavle-side lagt inn av læreren: mobilene får vite plasseringen sin.
  if (cur.type === 'scoreboard') { G.phase = 'scoreboard'; return commit(); }
  prepareQuestion(cur);
  G.phase = 'intro';
  G.introEnd = Date.now() + INTRO_MS;
  commit(); // mobilene får spørsmålet nå og starter selv etter «Gjør deg klar»
  introTimer = setTimeout(startQuestion, INTRO_MS);
}

function prepareQuestion(cur) {
  G.climber = null;
  let n = 0;
  if (cur.type === 'quiz' || cur.type === 'poll') n = cur.options.length;
  if (cur.type === 'order') n = cur.items.length;
  G.map = null; G.labels = null;
  if (n) {
    let map = [...Array(n).keys()];
    if (cur.type === 'order') {
      for (let k = 0; k < 10 && map.every((v, i) => v === i); k++) map = shuffle(map);
    } else if (quiz.settings?.shuffle) map = shuffle(map);
    G.map = map;
    G.labels = map.map(i => (cur.type === 'order' ? cur.items[i] : cur.options[i].text));
  }
}

function startQuestion() {
  clearTimeout(introTimer);
  if (!G.labels && ['quiz', 'poll', 'order'].includes(q().type)) prepareQuestion(q());
  G.answers = {};
  G.qStart = Date.now();
  G.phase = 'question';
  commit(false); // ingen ny melding – mobilene vet allerede når spørsmålet starter
  startTicker();
  if (TEST) botsAnswer();
}

// ---------- Testelever (prøvekjøring) ----------
function botsAnswer() {
  const cur = q(), qi = G.qi, round = G.round;
  const limit = Math.max(2000, cur.time * 1000 * 0.7);
  Object.keys(G.players).forEach(id => {
    setTimeout(() => onAnswer({ id, qi, round, value: botValue(cur) }), 1200 + Math.random() * Math.min(limit, 9000));
  });
}
function botValue(cur) {
  const right = Math.random() < 0.6;
  const pick = n => Math.floor(Math.random() * n);
  switch (cur.type) {
    case 'quiz': {
      const n = G.labels.length;
      const ok = [...Array(n).keys()].filter(d => judge(cur, d, G.map));
      return right && ok.length ? ok[pick(ok.length)] : pick(n);
    }
    case 'poll': return pick(G.labels.length);
    case 'truefalse': return right ? (cur.tf ? 0 : 1) : pick(2);
    case 'short': return right ? cur.answers[0] : '?';
    case 'wordcloud': return [['🐐', 'Kwest', 'GOAT', 'Peak', 'Fjell'][pick(5)]];
    case 'slider': return right ? cur.correct : Math.round(cur.min + Math.random() * (cur.max - cur.min));
    case 'order': return right ? cur.items.map((_, pos) => G.map.indexOf(pos)) : shuffle(G.map.map((_, d) => d));
    default: return 0;
  }
}
function botReact() {
  if (!G.reactions || !REACT_PHASES.includes(G.phase) || Math.random() < 0.5) return;
  const id = Object.keys(G.players).filter(x => x.startsWith('bot'))[Math.floor(Math.random() * BOTS.length)];
  if (id) onReact({ id, g: Math.floor(Math.random() * 3), p: Math.floor(Math.random() * 2) });
}

function startTicker() {
  clearInterval(tick);
  tick = setInterval(() => {
    const left = G.qStart + q().time * 1000 - Date.now();
    const el = document.querySelector('.timer-num');
    if (el) el.textContent = Math.max(0, Math.ceil(left / 1000));
    const ring = document.querySelector('.timer-ring');
    if (ring) ring.style.setProperty('--p', Math.max(0, left / (q().time * 1000)));
    if (left <= 0) reveal();
  }, 200);
}

// Første runde av et diskusjonsspørsmål er ferdig: elevene diskuterer, og svarene holdes skjult.
function toDiscuss() {
  const cur = q();
  const n = cur.type === 'truefalse' ? 2 : G.labels.length;
  G.first = Array(n).fill(0);
  Object.values(G.answers).forEach(a => { if (G.first[a.value] !== undefined) G.first[a.value]++; });
  G.firstN = Object.keys(G.answers).length;
  G.phase = 'discuss';
  commit();
}

function revote() {
  clearTimeout(introTimer);
  G.round = 2;
  G.answers = {};
  G.discussNow = false;
  G.phase = 'intro';
  G.introEnd = Date.now() + INTRO_MS;
  commit();
  introTimer = setTimeout(startQuestion, INTRO_MS);
}

function discussNow() {
  G.discussNow = true;
  reveal();
}

function rankMap() {
  const m = {};
  ranked().forEach(r => { m[r.id] = r.rank; });
  return m;
}

function reveal() {
  clearTimeout(allInTimer);
  allInTimer = null;
  if (G.phase !== 'question') return;
  clearInterval(tick);
  const cur = q();
  if (G.round === 1 && canDiscuss(cur) && (cur.discuss || G.discussNow)) return toDiscuss();
  const scored = SCORED.includes(cur.type);
  const before = scored ? rankMap() : null;
  for (const [id, pl] of Object.entries(G.players)) {
    const a = G.answers[id];
    pl.answered = !!a;
    pl.history ||= {};
    if (!scored) {
      pl.ok = null; pl.pts = 0;
      if (a) pl.history[G.qi] = { a: answerText(cur, a.value) };
      continue;
    }
    pl.ok = a ? judge(cur, a.value, G.map) : false;
    pl.pts = pl.ok ? speedPoints(cur, a.t) : 0;
    pl.score += pl.pts;
    pl.streak = pl.ok ? pl.streak + 1 : 0;
    pl.history[G.qi] = { a: a ? answerText(cur, a.value) : '', ok: pl.ok, pts: pl.pts };
  }
  // Comeback: hvem klatret mest på dette spørsmålet?
  if (scored) {
    const after = rankMap();
    G.climber = null;
    for (const [id, pl] of Object.entries(G.players)) {
      pl.climb = (before[id] || after[id]) - after[id];
      if (pl.climb >= 2 && (!G.climber || pl.climb > G.climber.n || (pl.climb === G.climber.n && pl.score > G.players[G.climber.id].score))) G.climber = { id, n: pl.climb };
    }
  }
  G.phase = 'reveal';
  commit();
}

// Gjør et svar om til lesbar tekst (til nedlastingen).
function answerText(cur, v) {
  if (v === undefined || v === null) return '';
  switch (cur.type) {
    case 'quiz': case 'poll': return cur.options[G.map ? G.map[v] : v]?.text ?? '';
    case 'truefalse': return v === 0 ? t('ed.true') : t('ed.false');
    case 'order': return Array.isArray(v) ? v.map(d => cur.items[G.map[d]]).join(' > ') : '';
    case 'wordcloud': return Array.isArray(v) ? v.join(', ') : String(v);
    case 'slider': return String(v) + (cur.unit ? ' ' + cur.unit : '');
    default: return String(v);
  }
}

function downloadResults() {
  const esc = v => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const qsAll = quiz.questions.map((x, i) => ({ q: playable(x), i })).filter(x => x.q.type !== 'info' && x.q.type !== 'scoreboard');
  const head = [t('res.place'), t('res.name'), ...(G.teams ? [t('res.team')] : []), t('res.score'), t('res.correct'),
    ...qsAll.map(x => `${x.i + 1}. ${(x.q.text || t('type.' + x.q.type)).replace(/\s+/g, ' ').slice(0, 60)}`)];
  const rows = ranked().map(p => {
    const hist = p.history || {};
    const nOk = Object.values(hist).filter(h => h.ok).length;
    return [p.rank, p.name, ...(G.teams ? [teamName(G.teamOf[p.id] ?? 0)] : []), p.score, nOk, ...qsAll.map(x => {
      const h = hist[x.i];
      if (!h) return '';
      if (h.ok === undefined) return h.a;
      return `${h.a} (${h.ok ? '✓' : '✗'}${h.pts ? ' ' + h.pts : ''})`;
    })];
  });
  // Semikolon og BOM gjør at Excel med norske innstillinger åpner filen riktig.
  const csv = '\ufeff' + [head, ...rows].map(r => r.map(esc).join(';')).join('\r\n');
  const a = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })),
    download: `${(quiz.title || 'kwest').replace(/[^\wæøåÆØÅ\- ]+/g, '').trim().replace(/\s+/g, '-')}-resultater-${new Date().toISOString().slice(0, 10)}.csv` });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function podium() {
  clearInterval(tick);
  G.phase = 'podium';
  commit();
  sessionStorage.removeItem(STORE);
}

async function endGame() {
  if (G.phase !== 'podium' && !(await confirmBox(t('host.end'), t('host.endConfirm'), t('host.end'), t('common.cancel')))) return;
  ch?.send('end', {});
  sessionStorage.removeItem(STORE);
  setTimeout(() => { location.href = TEST ? 'studio.html#/rediger/' + quizId : 'studio.html'; }, 300);
}

function commit(send = true) {
  persist();
  if (send) broadcast();
  render();
}

// ---------- Visning ----------
function joinHost() { return baseUrl().replace(/^https?:\/\//, '').replace(/\/$/, ''); }
function joinUrl() { return baseUrl() + '?pin=' + G.pin; }

function topbar() {
  return h('header', { class: 'hbar' },
    wordmark(30),
    TEST ? h('span', { class: 'test-tag' }, '🧪 ' + t('test.tag')) : G.phase !== 'lobby' ? h('span', { class: 'hbar-pin' }, joinHost() + ' · ' + t('host.pin') + ' ', h('b', null, G.pin)) : null,
    h('span', { class: 'spacer' }),
    h('span', { class: 'hbar-count' }, icon('user'), h('span', { class: 'hbar-n' }, playerIds().length)),
    h('button', { class: 'btn ghost small react-toggle' + (G.reactions ? ' on' : ''), title: t('host.reactionsHelp'), 'aria-pressed': String(G.reactions), onclick: toggleReactions },
      REACTIONS.g + ' ' + (G.reactions ? t('host.reactionsOn') : t('host.reactionsOff'))),
    langButton(render),
    h('button', { class: 'icon-btn', title: t('host.fullscreen'), 'aria-label': t('host.fullscreen'), onclick: toggleFullscreen }, icon('expand')),
    h('button', { class: 'btn ghost small', onclick: endGame }, t('host.end')));
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}

function render() {
  if (!quiz) return;
  app.querySelectorAll('audio').forEach(a => a.pause());
  clear(app);
  app.append(topbar());
  const main = h('main', { class: 'hmain phase-' + G.phase });
  app.append(main);
  ({ lobby: renderLobbyInto, intro: renderIntro, question: renderQuestion, info: renderInfo, reveal: renderReveal, discuss: renderDiscuss, scoreboard: renderScoreboard, podium: renderPodium })[G.phase](main);
}

function renderLobby() { if (G.phase === 'lobby') render(); }

function qrSvg(text) {
  const qr = window.qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const el = svg(qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true }));
  el.removeAttribute('width'); el.removeAttribute('height');
  return el;
}

function renderLobbyInto(main) {
  const ids = playerIds();
  if (TEST) put(main, h('section', { class: 'lobby-top test' },
    h('div', { class: 'lobby-join' },
      h('h1', { class: 'lobby-title' }, quiz.title),
      h('p', { class: 'lobby-at' }, '🧪 ', h('b', null, t('test.title'))),
      h('p', { class: 'lobby-scan' }, t('test.text')))));
  else put(main,
    h('section', { class: 'lobby-top' },
      h('div', { class: 'lobby-join' },
        h('h1', { class: 'lobby-title' }, quiz.title),
        h('p', { class: 'lobby-at' }, t('host.joinAt'), ' ', h('b', null, joinHost())),
        h('div', { class: 'lobby-pin' }, h('span', null, t('host.pin')), h('strong', null, G.pin.slice(0, 3) + ' ' + G.pin.slice(3))),
        h('p', { class: 'lobby-scan' }, t('host.orScan'))),
      h('div', { class: 'lobby-qr' }, qrSvg(joinUrl()))));
  put(main,
    h('section', { class: 'lobby-players' },
      h('div', { class: 'lobby-bar' },
        h('span', { class: 'lobby-count' }, t('host.players', { n: ids.length })),
        ids.length ? h('span', { class: 'muted' }, t('host.kickHint')) : null,
        h('span', { class: 'spacer' }),
        h('label', { class: 'team-pick' }, icon('team'), h('select', { 'aria-label': t('host.teams'), onchange: e => setTeams(Number(e.target.value)) },
          [0, 2, 3, 4, 5, 6, 7, 8].map(n => h('option', { value: n, selected: n === G.teams }, n ? t('host.nTeams', { n }) : t('host.noTeams'))))),
        h('button', { class: 'btn ghost', onclick: () => { G.locked = !G.locked; persist(); render(); } }, G.locked ? [icon('lock'), t('host.unlock')] : [icon('unlock'), t('host.lock')]),
        h('button', { class: 'btn primary big', onclick: next }, t('host.start'))),
      !ids.length ? h('p', { class: 'waiting' }, h('span', { class: 'spinner small' }), t('host.waiting'))
        : G.teams ? h('div', { class: 'team-cols' }, [...Array(G.teams).keys()].map(ti => {
          const members = ids.filter(id => G.teamOf[id] === ti);
          return h('div', { class: 'team-col', style: { '--tc': TEAM_COLORS[ti] } },
            h('h3', { class: 'team-head' }, teamName(ti), h('span', null, members.length)),
            h('div', { class: 'chips many' }, members.map(chip)));
        }))
        : h('div', { class: 'chips' + (ids.length > 30 ? ' many' : '') }, ids.map(chip))));
}

function chip(id) {
  const isNew = !shownChips.has(id);
  shownChips.add(id);
  return h('button', { class: 'chip' + (isNew ? ' new' : ''), onclick: () => kick(id) }, G.players[id].name);
}

function audioPlayer(cur, autoplay) {
  if (!cur.audio) return null;
  const el = h('audio', { src: cur.audio, controls: true, preload: 'auto' });
  if (autoplay && cur.autoplay !== false) setTimeout(() => el.play().catch(() => {}), 150);
  return h('div', { class: 'audio-box' }, h('span', { class: 'audio-icon' }, icon('sound', 26)), el);
}

function questionHead(cur, i = G.qi) {
  return h('div', { class: 'qhead' },
    h('span', { class: 'qhead-mark' }, questionSvg(54)),
    h('div', null,
      h('div', { class: 'qhead-n' }, t('host.question', { n: i + 1, total: total() })),
      h('h1', { class: 'qhead-text' + (cur.text.length > 120 ? ' long' : '') }, cur.text)));
}

function renderIntro(main) {
  const cur = q();
  put(main, h('div', { class: 'intro' + (isFinale() ? ' finale' : '') },
    G.round === 2 ? h('div', { class: 'intro-badge' }, '💬 ' + t('host.revote')) : isFinale() ? h('div', { class: 'intro-badge finale' }, t('host.finale')) : null,
    h('div', { class: 'intro-mark' }, questionSvg(120)),
    h('div', { class: 'qhead-n' }, t('host.question', { n: G.qi + 1, total: total() }) + ' · ' + t('type.' + cur.type)),
    h('h1', { class: 'intro-text' }, cur.text),
    h('div', { class: 'intro-bar' }, h('span', { style: { animationDuration: INTRO_MS + 'ms' } }))));
}

function renderInfo(main) {
  const cur = q();
  put(main, h('div', { class: 'info-slide' },
    h('span', { class: 'qhead-mark' }, exclamationSvg(70)),
    cur.text ? h('div', { class: 'info-text' }, cur.text) : null,
    cur.image ? h('img', { class: 'qimg', src: cur.image, alt: '' }) : null,
    audioPlayer(cur, true)),
    h('div', { class: 'hfoot' }, h('span', null), h('button', { class: 'btn primary big', onclick: next }, t('host.next'))));
}

function tiles(cur, opts = {}) {
  if (!G.labels && cur.type !== 'truefalse') return null;
  const labels = cur.type === 'truefalse' ? [t('ed.true'), t('ed.false')] : G.labels;
  return h('div', { class: 'tiles n' + labels.length + (opts.reveal ? ' revealed' : '') },
    labels.map((label, i) => {
      const correct = opts.correct?.[i];
      return h('div', { class: 'tile' + (opts.reveal && correct === false ? ' dim' : ''), style: { background: COLORS[colorIndex(cur.type, i)] } },
        h('span', { class: 'shape' }, svg(SHAPES[colorIndex(cur.type, i)])),
        h('span', { class: 'tile-text' }, label),
        opts.reveal && correct ? h('span', { class: 'tile-check' }, '✓') : null,
        opts.reveal && correct === false ? h('span', { class: 'tile-wrong' }, '✕') : null,
      );
    }));
}

function renderQuestion(main) {
  const cur = q();
  const left = Math.max(0, G.qStart + cur.time * 1000 - Date.now());
  let middle = h('div', { class: 'big-q' }, questionSvg(150));
  if (cur.type === 'short' || cur.type === 'wordcloud') middle = h('p', { class: 'answer-on-phone' }, '✎');
  if (cur.type === 'slider') middle = h('div', { class: 'slider-preview' }, h('span', null, cur.min), h('div', { class: 'slider-line' }), h('span', null, cur.max + (cur.unit ? ' ' + cur.unit : '')));
  put(main, 
    questionHead(cur),
    h('div', { class: 'qbody' },
      h('div', { class: 'timer-ring', style: { '--p': left / (cur.time * 1000) } }, h('span', { class: 'timer-num' }, Math.ceil(left / 1000))),
      cur.image ? h('img', { class: 'qimg', src: cur.image, alt: '' }) : h('div', { class: 'qimg-empty' }, middle),
      h('div', { class: 'acount' }, h('strong', { class: 'acount-n' }, Object.keys(G.answers).length), h('span', null, t('host.answers')),
        h('button', { class: 'btn ghost small', onclick: reveal }, t('host.skip')),
        canDiscuss(cur) && G.round === 1 && !cur.discuss ? h('button', { class: 'btn ghost small', title: t('host.discussHelp'), onclick: discussNow }, '💬 ' + t('host.discussBtn')) : null,
        G.round === 2 ? h('span', { class: 'round-tag' }, t('host.round2')) : null)),
    audioPlayer(cur, true),
    tiles(cur));
}

function updateCount() {
  const el = document.querySelector('.acount-n');
  if (el) el.textContent = Object.keys(G.answers).length;
  const cn = document.querySelector('.hbar-n');
  if (cn) cn.textContent = playerIds().length;
}

function renderReveal(main) {
  const cur = q();
  const answers = Object.values(G.answers);
  const nCorrect = Object.values(G.players).filter(p => p.ok).length;
  const nPlayers = playerIds().length;
  put(main, questionHead(cur));
  let body;
  if (cur.type === 'quiz' || cur.type === 'poll' || cur.type === 'truefalse') {
    const n = cur.type === 'truefalse' ? 2 : G.labels.length;
    const counts = Array(n).fill(0);
    answers.forEach(a => { if (counts[a.value] !== undefined) counts[a.value]++; });
    const correct = cur.type === 'poll' ? null : [...Array(n).keys()].map(i => judge(cur, i, G.map));
    if (G.round === 2 && G.first && correct && G.firstN) {
      const pct = (c, tot) => Math.round(100 * c / Math.max(1, tot));
      const before = pct(G.first.reduce((s, c, i) => s + (correct[i] ? c : 0), 0), G.firstN);
      const after = pct(counts.reduce((s, c, i) => s + (correct[i] ? c : 0), 0), answers.length);
      put(main, h('p', { class: 'before-after' }, '💬 ' + t('host.beforeAfter', { a: before, b: after })));
    }
    body = h('div', { class: 'reveal-wrap' },
      h('div', { class: 'reveal-top' + (cur.image ? ' with-img' : '') },
        cur.image ? h('img', { class: 'qimg small', src: cur.image, alt: '' }) : null,
        bars(cur, counts, correct),
        explanationBox(cur)),
      tiles(cur, { correct, reveal: true }));
  } else if (cur.type === 'short') {
    const groups = {};
    answers.forEach(a => { const k = normText(a.value); (groups[k] ||= { text: String(a.value), n: 0 }).n++; });
    const list = Object.values(groups).sort((a, b) => b.n - a.n).slice(0, 12);
    body = h('div', { class: 'reveal-wrap short' },
      h('div', { class: 'correct-box' }, h('span', null, t('host.correctAnswer')), h('strong', null, cur.answers.join(' / '))),
      list.length ? h('ul', { class: 'answer-list' }, list.map(g => h('li', { class: judge(cur, g.text) ? 'ok' : '' }, h('span', null, g.text), h('b', null, g.n)))) : h('p', { class: 'muted' }, t('host.noAnswers')));
  } else if (cur.type === 'wordcloud') {
    body = wordCloud(answers);
  } else if (cur.type === 'slider') {
    body = sliderReveal(cur, answers);
  } else if (cur.type === 'order') {
    body = h('div', { class: 'reveal-wrap' },
      h('ol', { class: 'order-list' }, cur.items.map((it, i) => {
        const d = G.map.indexOf(i);
        return h('li', { style: { background: COLORS[d] } }, h('span', { class: 'shape' }, svg(SHAPES[d])), h('span', null, it));
      })));
  }
  // Forklaring ved siden av (for typer uten søyler; der står den allerede ved søylene).
  const sideExp = ['quiz', 'poll', 'truefalse'].includes(cur.type) ? null : explanationBox(cur);
  put(main, h('div', { class: 'reveal-body' }, sideExp ? h('div', { class: 'reveal-split' }, body, sideExp) : body), audioPlayer(cur, false));
  put(main, h('div', { class: 'hfoot' },
    SCORED.includes(cur.type) ? h('span', { class: 'reveal-stat' }, t('host.correctCount', { n: nCorrect, total: nPlayers })) : h('span', null),
    h('button', { class: 'btn primary big', onclick: next }, G.qi >= total() - 1 ? t('host.podium') : t('host.next'))));
}

// Fasiten som tekst til mobilen, slik at den kan vise «Riktig svar: …» til de som svarte feil.
function correctAnswer(cur) {
  switch (cur.type) {
    case 'quiz': return { correct: cur.options.filter(o => o.correct).map(o => o.text).join(' / ') };
    case 'truefalse': return { tf: !!cur.tf };
    case 'short': return { correct: cur.answers[0] || '' };
    case 'slider': return { correct: cur.correct + (cur.unit ? ' ' + cur.unit : '') };
    case 'order': return { correct: cur.items.join(' → ') };
    default: return {};
  }
}

function explanationBox(cur) {
  const exp = (cur.explanation || '').trim();
  if (!exp) return null; // tomt felt = ingen boks
  return h('aside', { class: 'exp-box' }, h('b', null, icon('book', 16), t('host.explanation')), h('p', null, exp));
}

function bars(cur, counts, correct) {
  // Etter «stem igjen»: første runde vises som en lys søyle ved siden av.
  const first = G.round === 2 && G.first ? G.first : null;
  const max = Math.max(1, ...counts, ...(first || []));
  return h('div', { class: 'bars' + (first ? ' with-first' : '') }, counts.map((c, i) => {
    const ci = colorIndex(cur.type, i);
    return h('div', { class: 'bar-col' + (correct && !correct[i] ? ' dim' : '') },
      h('div', { class: 'bar-n' }, correct?.[i] ? '✓ ' : '', first ? h('span', { class: 'bar-first-n' }, first[i] + ' → ') : null, c),
      h('div', { class: 'bar-area' },
        first ? h('div', { class: 'bar first', title: t('host.round1'), style: { height: Math.max(3, first[i] / max * 100) + '%', background: COLORS[ci] } }) : null,
        h('div', { class: 'bar', style: { height: Math.max(3, c / max * 100) + '%', background: COLORS[ci] } })),
      h('div', { class: 'bar-shape', style: { background: COLORS[ci] } }, svg(SHAPES[ci])));
  }));
}

function renderDiscuss(main) {
  const cur = q();
  put(main,
    questionHead(cur),
    h('div', { class: 'discuss' },
      h('div', { class: 'discuss-icon' }, '💬'),
      h('h1', null, t('host.discussTitle')),
      h('p', null, t('host.discussText', { n: G.firstN, total: playerIds().length }))),
    tiles(cur),
    h('div', { class: 'hfoot' }, h('span', { class: 'muted' }, t('host.discussHidden')), h('button', { class: 'btn primary big', onclick: next }, '💬 ' + t('host.revoteBtn'))));
}

function wordCloud(answers) {
  const words = {};
  answers.forEach(a => (Array.isArray(a.value) ? a.value : [a.value]).forEach(w => {
    const k = normText(w);
    if (!k || G.hidden.includes(k)) return;
    (words[k] ||= { text: String(w).trim().slice(0, 25), n: 0 }).n++;
  }));
  const list = Object.entries(words).sort((a, b) => b[1].n - a[1].n).slice(0, 60);
  if (!list.length) return h('p', { class: 'muted center-text' }, t('host.noAnswers'));
  const max = list[0][1].n;
  // Største ord i midten, de andre fordelt annenhver side.
  const arranged = [];
  list.forEach((w, i) => (i % 2 ? arranged.push(w) : arranged.unshift(w)));
  const palette = ['#2A1D05', '#E07B10', '#1F5FD1', '#1E8B3A', '#7A3BD9', '#D62839'];
  return h('div', { class: 'cloud-wrap' },
    h('div', { class: 'cloud' }, arranged.map(([k, w], i) => h('button', {
      class: 'cloud-word', title: t('host.hideWord'),
      style: { fontSize: (1.1 + (w.n / max) * 3.6).toFixed(2) + 'rem', color: palette[(i * 7) % palette.length] },
      onclick: () => { G.hidden.push(k); persist(); render(); },
    }, w.text))),
    h('p', { class: 'muted small-text' }, t('host.hideWord')));
}

function sliderReveal(cur, answers) {
  const span = cur.max - cur.min;
  const pos = v => ((Math.min(cur.max, Math.max(cur.min, v)) - cur.min) / span * 100) + '%';
  const unit = cur.unit ? ' ' + cur.unit : '';
  return h('div', { class: 'reveal-wrap' },
    h('div', { class: 'correct-box' }, h('span', null, t('host.correctAnswer')), h('strong', null, cur.correct + unit),
      cur.tolerance ? h('span', null, t('host.within', { n: cur.tolerance })) : null),
    h('div', { class: 'numline' },
      h('div', { class: 'numline-band', style: { left: pos(cur.correct - cur.tolerance), width: `calc(${pos(cur.correct + cur.tolerance)} - ${pos(cur.correct - cur.tolerance)})` } }),
      answers.map(a => h('span', { class: 'numline-dot' + (judge(cur, a.value) ? ' ok' : ''), style: { left: pos(Number(a.value)) } })),
      h('span', { class: 'numline-correct', style: { left: pos(cur.correct) } }),
      h('span', { class: 'numline-end l' }, cur.min + unit), h('span', { class: 'numline-end r' }, cur.max + unit)));
}

// Poengtavle: en sti opp fjellet på dagtid. Jo flere poeng, jo lenger opp stien.
// Toppen tilsvarer alle mulige poeng så langt i spillet, så ledende spiller klatrer gradvis gjennom kwestet.
// Stien går i slyngninger oppover selve fjellsiden (ikke i lufta) til flagget på toppen.
const TRAIL = 'M110 668 C 300 650, 480 640, 640 630 S 960 610, 1120 585 S 1100 520, 1000 490 S 1080 440, 1200 425 S 1170 380, 1120 360 S 1190 300, 1230 250 S 1262 180, 1268 148';

function trailScene() {
  return svg(`<svg class="scene" viewBox="0 0 1600 700" aria-hidden="true">
    <defs>
      <linearGradient id="dsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6FB8EC"/><stop offset=".55" stop-color="#BFE3F7"/><stop offset="1" stop-color="#FFF0CF"/></linearGradient>
      <radialGradient id="dsun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFFBE6"/><stop offset=".45" stop-color="#FFE58A"/><stop offset="1" stop-color="#FFE58A" stop-opacity="0"/></radialGradient>
      <linearGradient id="dmtn" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A9B7C9"/><stop offset=".6" stop-color="#7D8EA6"/><stop offset="1" stop-color="#5E6F88"/></linearGradient>
      <linearGradient id="dmeadow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9FCB7C"/><stop offset="1" stop-color="#5E9B55"/></linearGradient>
      <linearGradient id="dmeadow2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7FB466"/><stop offset="1" stop-color="#477F43"/></linearGradient>
    </defs>
    <rect width="1600" height="700" fill="url(#dsky)"/>
    <circle cx="300" cy="120" r="150" fill="url(#dsun)" class="dsun"/>
    <g class="clouds" fill="#fff" opacity=".85">
      <g class="cloud c1"><ellipse cx="620" cy="110" rx="70" ry="22"/><ellipse cx="660" cy="96" rx="44" ry="28"/><ellipse cx="590" cy="104" rx="34" ry="20"/></g>
      <g class="cloud c2"><ellipse cx="1420" cy="200" rx="60" ry="18"/><ellipse cx="1450" cy="188" rx="36" ry="24"/></g>
      <g class="cloud c3"><ellipse cx="900" cy="60" rx="50" ry="14"/><ellipse cx="925" cy="50" rx="30" ry="18"/></g>
    </g>
    <path d="M0 470 L130 400 L250 440 L370 360 L500 430 L620 380 L700 420 L800 360 L900 420 L1000 380 L1100 430 V700 H0Z" fill="#B9CCE2" opacity=".9"/>
    <path d="M1380 360 L1480 300 L1600 350 V700 H1380Z" fill="#B9CCE2" opacity=".9"/>
    <polygon points="560,700 760,470 860,500 1000,330 1080,300 1268,128 1340,190 1420,250 1500,360 1600,420 1600,700" fill="url(#dmtn)"/>
    <polygon points="1268,128 1340,190 1420,250 1500,360 1600,420 1600,700 1240,700 1250,400" fill="#3E4C66" opacity=".25"/>
    <polygon points="1268,128 1226,168 1244,176 1258,160 1272,182 1290,164 1316,170" fill="#fff" opacity=".9"/>
    <path d="M0 640 C 220 560, 420 600, 620 560 S 900 520, 1000 560 S 1300 600, 1600 560 V700 H0Z" fill="url(#dmeadow)"/>
    <path d="M0 690 C 260 640, 520 680, 780 650 S 1200 640, 1600 680 V700 H0Z" fill="url(#dmeadow2)"/>
    <g fill="#3F7A3E" opacity=".9"><path d="M170 640 l14 -40 l14 40z"/><path d="M200 650 l12 -34 l12 34z"/><path d="M1440 610 l14 -40 l14 40z"/><path d="M1470 620 l12 -34 l12 34z"/></g>
    <path class="trail-path" d="${TRAIL}" fill="none" stroke="#F3E2B8" stroke-width="16" stroke-linecap="round" opacity=".9"/>
    <path d="${TRAIL}" fill="none" stroke="#C9A86A" stroke-width="3" stroke-dasharray="2 14" stroke-linecap="round"/>
    <line x1="1268" y1="140" x2="1268" y2="96" stroke="#2A1D05" stroke-width="3"/>
    <path d="M1269 98 h34 l-8 9 l8 9 h-34z" fill="#FFB424" stroke="#2A1D05" stroke-width="2" stroke-linejoin="round"/>
  </svg>`);
}

function climberBanner() {
  const c = G.climber && G.players[G.climber.id];
  if (!c) return h('span', null);
  return h('div', { class: 'climber' }, '🚀 ', t('host.climber', { name: c.name, n: G.climber.n }));
}

function renderScoreboard(main) {
  // Med lag går lagene (snittpoeng) opp stien i stedet for enkeltelevene.
  const all = G.teams ? rankedTeams() : ranked();
  // Mulige poeng så langt = toppen av fjellet.
  const possible = quiz.questions.slice(0, G.qi + 1).map((x, i) => qAt(i)).filter(x => SCORED.includes(x.type)).reduce((sum, x) => sum + basePoints(x), 0) || 1;
  const scene = h('div', { class: 'trail-scene' }, trailScene(), h('h1', { class: 'scene-title day' }, G.teams ? t('host.teamBoard') : t('host.scoreboard')));
  put(main, scene, h('div', { class: 'hfoot' }, climberBanner(), h('button', { class: 'btn primary big', onclick: next }, t('host.next'))));

  const path = scene.querySelector('.trail-path');
  const L = path.getTotalLength();
  const at = frac => {
    const pt = path.getPointAtLength(L * (0.03 + 0.95 * Math.min(1, Math.max(0, frac))));
    return { left: (pt.x / 16) + '%', top: (pt.y / 7) + '%' };
  };
  const frac = score => score / possible;
  // Alle andre som små prikker langs stien.
  all.slice(5).forEach(p => scene.append(h('div', { class: 'trail-dot', style: at(frac(p.score)) })));
  // De fem beste, som går fra forrige plass til ny plass langs stien.
  const top = all.slice(0, 5);
  const ends = top.map(p => frac(p.score));
  // Står de tett, får de litt luft mellom seg på stien, og navnene vises i en egen liste.
  for (let i = 1; i < ends.length; i++) ends[i] = Math.min(ends[i], ends[i - 1] - 0.03);
  const crowded = top.some((p, i) => i && frac(top[i - 1].score) - frac(p.score) < 0.1);
  const label = p => h('span', { class: 'trail-label' },
    h('b', { style: p.color ? { color: p.color } : null }, p.name),
    h('span', null, p.score + ' p', p.pts ? h('em', null, ' +' + p.pts) : null, p.streak > 1 ? ' 🔥' + p.streak : null));
  const markers = top.map((p, i) => {
    const endX = parseFloat(at(ends[i]).left);
    // Navnelappen står annenhver gang til høyre og venstre, men aldri utenfor kanten.
    const side = endX < 18 ? '' : endX > 80 ? ' left' : (i % 2 ? ' left' : '');
    const m = h('div', { class: 'trail-marker r' + p.rank + side, style: at(Math.min(frac(p.score - p.pts), ends[i])) },
      h('span', { class: 'trail-rank' }, p.rank), crowded ? null : label(p));
    return { m, from: Math.min(frac(p.score - p.pts), ends[i]), to: ends[i] };
  }).reverse(); // lederen tegnes øverst
  markers.forEach(x => scene.append(x.m));
  if (crowded) {
    scene.append(h('ol', { class: 'trail-list' }, top.map(p => h('li', null,
      h('span', { class: 'trail-rank static' + (p.rank === 1 ? ' gold' : '') }, p.rank), label(p)))));
  }
  const start = performance.now() + 400, dur = 1800;
  const step = now => {
    if (!scene.isConnected) return;
    const k = Math.min(1, Math.max(0, (now - start) / dur));
    const e = 1 - Math.pow(1 - k, 3);
    markers.forEach(x => Object.assign(x.m.style, at(x.from + (x.to - x.from) * e)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Pallen: tre fjelltopper (gull, sølv, bronse) som en fjellkjede foran en solnedgang.
// Toppene ligger på faste steder i en scene på 1600 × 700, slik at navnene kan plasseres over dem.
const PEAKS = [
  { place: 1, x: 800, y: 140, metal: ['#FFE08A', '#E3A83A', '#7A4E17'],
    ridge: '430,700 600,420 660,450 760,215 800,140 852,232 930,332 985,310 1170,700',
    shade: '800,140 852,232 930,332 985,310 1170,700 830,700 812,380',
    snow: '800,140 760,215 778,226 792,208 806,230 824,206 852,232' },
  { place: 2, x: 430, y: 300, metal: ['#F4F6FA', '#B9C0CC', '#4B5160'],
    ridge: '40,700 250,470 300,500 390,342 430,300 482,362 560,452 620,432 800,700',
    shade: '430,300 482,362 560,452 620,432 800,700 460,700 440,520',
    snow: '430,300 390,342 404,352 418,338 432,356 446,338 482,362' },
  { place: 3, x: 1170, y: 390, metal: ['#F6C9A0', '#C98450', '#5A321C'],
    ridge: '800,700 980,540 1030,562 1130,430 1170,390 1222,452 1300,522 1352,508 1560,700',
    shade: '1170,390 1222,452 1300,522 1352,508 1560,700 1190,700 1178,560',
    snow: '1170,390 1130,430 1144,440 1158,426 1172,444 1186,426 1222,452' },
];
const RISE = { 1: 1.7, 2: 0.95, 3: 0.25 }; // sekunder: bronse først, gull til slutt
const SQUASH = 0.74; // fjellene skaleres ned i høyden så navnene får plass over toppene
const peakY = y => 700 - (700 - y) * SQUASH;

function podiumScene() {
  let stars = '';
  for (let i = 0; i < 46; i++) {
    const x = (i * 337) % 1600, y = 18 + ((i * 131) % 230), r = 0.8 + (i % 3) * 0.55;
    stars += `<circle class="star" cx="${x}" cy="${y}" r="${r}" style="animation-delay:${(i % 7) * 0.45}s"/>`;
  }
  const peaks = PEAKS.slice().sort((a, b) => a.place - b.place).map(p => `
    <g class="peak" style="animation-delay:${RISE[p.place]}s">
      <defs><linearGradient id="pk${p.place}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${p.metal[0]}"/><stop offset=".35" stop-color="${p.metal[1]}"/><stop offset="1" stop-color="${p.metal[2]}"/>
      </linearGradient></defs>
      <g transform="translate(0 700) scale(1 ${SQUASH}) translate(0 -700)">
        <polygon points="${p.ridge}" fill="url(#pk${p.place})"/>
        <polygon points="${p.shade}" fill="#1B1030" opacity=".28"/>
        <polygon points="${p.snow}" fill="#FFFFFF" opacity=".55"/>
      </g>
      <text x="${p.x}" y="${(peakY(p.y) + 700) / 2 + 50}" class="peak-num">${p.place}</text>
    </g>`).join('');
  // Fjellene tegnes bakfra: 1 (midt) først, deretter 2 og 3 foran.
  return svg(`<svg class="scene" viewBox="0 0 1600 700" aria-hidden="true">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#1B1A47"/><stop offset=".32" stop-color="#5A2C6E"/><stop offset=".58" stop-color="#C9485E"/>
        <stop offset=".76" stop-color="#F98A3C"/><stop offset=".9" stop-color="#FFC45C"/>
      </linearGradient>
      <radialGradient id="sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFF7D1"/><stop offset=".55" stop-color="#FFD66B"/><stop offset="1" stop-color="#FFB347" stop-opacity="0"/></radialGradient>
      <radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFE29A" stop-opacity=".75"/><stop offset="1" stop-color="#FF9A4D" stop-opacity="0"/></radialGradient>
      <linearGradient id="far1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C15A78"/><stop offset="1" stop-color="#8E3F6E"/></linearGradient>
      <linearGradient id="far2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7D3A70"/><stop offset="1" stop-color="#3E2350"/></linearGradient>
      <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD9A0" stop-opacity="0"/><stop offset="1" stop-color="#FFD9A0" stop-opacity=".35"/></linearGradient>
    </defs>
    <rect width="1600" height="700" fill="url(#sky)"/>
    <g class="stars">${stars}</g>
    <circle class="sun-glow" cx="800" cy="500" r="420" fill="url(#glow)"/>
    <circle class="sun" cx="800" cy="500" r="135" fill="url(#sun)"/>
    <path d="M0 520 L90 470 L170 500 L260 440 L350 485 L450 430 L560 480 L660 445 L760 470 L880 420 L990 470 L1090 440 L1200 485 L1300 430 L1400 475 L1500 450 L1600 480 V700 H0Z" fill="url(#far1)" opacity=".8"/>
    <path d="M0 585 L120 530 L220 565 L330 515 L470 570 L600 530 L720 575 L860 525 L980 570 L1110 520 L1240 565 L1370 525 L1480 560 L1600 535 V700 H0Z" fill="url(#far2)" opacity=".85"/>
    <rect y="470" width="1600" height="160" fill="url(#mist)"/>
    <path class="birds" d="M300 205 q10 -9 20 0 q10 -9 20 0 M362 228 q7 -6 14 0 q7 -6 14 0 M1240 170 q9 -8 18 0 q9 -8 18 0" fill="none" stroke="#2A1838" stroke-width="3" stroke-linecap="round" opacity=".55"/>
    ${peaks}
    <rect y="680" width="1600" height="20" fill="#24152F"/>
  </svg>`);
}

function renderPodium(main) {
  if (reviewAt >= 0) return renderReview(main);
  const all = G.teams ? rankedTeams() : ranked();
  const people = ranked();
  const hard = hardest();
  const byPlace = { 1: all[0], 2: all[1], 3: all[2] };
  const labels = PEAKS.map(pk => {
    const p = byPlace[pk.place];
    if (!p) return null;
    return h('div', { class: 'summit s' + pk.place, style: { left: (pk.x / 16) + '%', top: (peakY(pk.y) / 7) + '%', animationDelay: (RISE[pk.place] + 0.9) + 's' } },
      h('div', { class: 'summit-name' }, p.name),
      h('div', { class: 'summit-score' }, p.score + ' p'),
      svg('<svg class="summit-flag" width="34" height="40" viewBox="0 0 34 40"><line x1="3" y1="2" x2="3" y2="40" stroke="#2A1D05" stroke-width="2.5"/><path d="M4 3 H30 L24 10 L30 17 H4 Z" fill="#FFB424" stroke="#2A1D05" stroke-width="1.6" stroke-linejoin="round"/></svg>'));
  });
  put(main,
    h('div', { class: 'podium-scene' },
      podiumScene(),
      h('h1', { class: 'scene-title' }, all.length ? (G.teams ? t('host.teamPodium') : t('host.podium')) : t('host.nobody')),
      labels),
    (G.teams ? people.length : people.length > 3) ? h('details', { class: 'all-results' }, h('summary', null, t('host.allResults')),
      h('ol', null, (G.teams ? people : people.slice(3)).map(p => h('li', { value: p.rank }, h('span', null, p.name), h('b', null, p.score))))) : null,
    h('div', { class: 'hfoot' },
      h('div', { class: 'row' },
        people.length ? h('button', { class: 'btn ghost', onclick: downloadResults }, [icon('download'), t('res.download')]) : null,
        hard.length ? h('button', { class: 'btn ghost', onclick: () => { reviewAt = 0; render(); } }, '🔍 ' + t('review.button', { n: hard.length })) : null),
      h('button', { class: 'btn primary big', onclick: endGame }, t('host.end'))));
}

// ---------- Gjennomgang: spørsmålene flest svarte feil på ----------
function hardest() {
  const ids = playerIds();
  if (!ids.length) return [];
  const list = [];
  quiz.questions.forEach((x, i) => {
    if (!SCORED.includes(x.type)) return;
    const hist = ids.map(id => G.players[id].history?.[i]).filter(Boolean);
    if (!hist.length) return; // spørsmålet ble ikke spilt
    const ok = hist.filter(hh => hh.ok).length;
    if (ok === ids.length) return;
    const wrong = {};
    hist.filter(hh => !hh.ok && hh.a).forEach(hh => { const k = normText(hh.a); (wrong[k] ||= { text: hh.a, n: 0 }).n++; });
    list.push({ i, pct: Math.round(100 * ok / ids.length), ok, total: ids.length, wrong: Object.values(wrong).sort((a, b) => b.n - a.n).slice(0, 4) });
  });
  return list.sort((a, b) => a.pct - b.pct || a.i - b.i).slice(0, 3);
}

function renderReview(main) {
  const list = hardest();
  const item = list[reviewAt];
  if (!item) { reviewAt = -1; return renderPodium(main); }
  const cur = qAt(item.i);
  const ans = correctAnswer(cur);
  const correctText = ans.tf !== undefined ? (ans.tf ? t('ed.true') : t('ed.false')) : ans.correct;
  const last = reviewAt >= list.length - 1;
  put(main,
    h('div', { class: 'review-head' }, h('span', { class: 'review-n' }, '🔍 ' + t('review.title', { n: reviewAt + 1, total: list.length })),
      h('span', { class: 'review-pct' }, t('review.pct', { n: item.pct }))),
    questionHead(cur, item.i),
    h('div', { class: 'review-body' },
      cur.image ? h('img', { class: 'qimg small', src: cur.image, alt: '' }) : null,
      h('div', { class: 'stack grow' },
        h('div', { class: 'correct-box' }, h('span', null, t('host.correctAnswer')), h('strong', null, correctText)),
        item.wrong.length ? h('div', { class: 'review-wrong' }, h('b', null, t('review.wrong')),
          h('ul', { class: 'answer-list' }, item.wrong.map(w => h('li', null, h('span', null, w.text), h('b', null, w.n))))) : null),
      explanationBox(cur)),
    audioPlayer(cur, false),
    h('div', { class: 'hfoot' },
      h('button', { class: 'btn ghost', onclick: () => { reviewAt = reviewAt > 0 ? reviewAt - 1 : -1; render(); } }, reviewAt > 0 ? '← ' + t('review.prev') : '← ' + t('review.back')),
      h('button', { class: 'btn primary big', onclick: () => { reviewAt = last ? -1 : reviewAt + 1; render(); } }, last ? t('review.back') : t('review.next') + ' →')));
}

document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea, button')) return;
  if ((e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') && ['lobby', 'reveal', 'scoreboard', 'info', 'discuss'].includes(G.phase)) { e.preventDefault(); next(); }
});

init();
