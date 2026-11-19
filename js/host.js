// Storskjermen: læreren starter spillet, viser spørsmål, resultater og pallen.
import { h, svg, clear, qs, makePin, shuffle, baseUrl, normText, confirmBox, toast } from './util.js';
import { t, langButton } from './i18n.js';
import { backend } from './backend.js';
import { COLORS, SHAPES, SCORED, colorIndex, playable, judge, speedPoints } from './game.js';
import { icon } from './icons.js';
import { wordmark, exclamationSvg, questionSvg, setFavicon } from './logo.js';

setFavicon();
const app = document.getElementById('app');
const quizId = qs('id');
const STORE = 'kwest-host-' + quizId;
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
  players: {}, // id -> { name, score, streak, ok, pts, answered, joinedAt }
  answers: {}, // id -> { value, t }
  map: null, labels: null, qStart: 0, hidden: [],
};

function q() { return quiz && G.qi >= 0 ? playable(quiz.questions[G.qi]) : null; }
function total() { return quiz.questions.length; }
function playerIds() { return Object.keys(G.players).sort((a, b) => G.players[a].joinedAt - G.players[b].joinedAt); }
function persist() { try { sessionStorage.setItem(STORE, JSON.stringify(G)); } catch { /* fullt */ } }

// ---------- Oppstart ----------
async function init() {
  if (backend.mode === 'demo') { document.body.classList.add('is-demo'); document.body.append(h('div', { class: 'demo-banner' }, t('demo.banner'))); }
  center(h('div', { class: 'spinner' }), t('host.loading'));
  const sess = await backend.session().catch(() => null);
  if (!sess?.profile?.approved) return center(exclamationSvg(80), t('host.loginFirst'), h('a', { class: 'btn primary', href: 'laerer.html' }, t('auth.login')));
  try {
    const row = await backend.getQuiz(quizId);
    quiz = row.data;
    quiz.title = row.title;
  } catch {
    return center(exclamationSvg(80), t('host.notFound'), h('a', { class: 'btn', href: 'laerer.html' }, t('host.back')));
  }
  if (!quiz.questions?.length) return center(exclamationSvg(80), t('host.notFound'));

  let restored = false;
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE));
    if (saved && saved.pin && saved.phase !== 'podium') { Object.assign(G, saved); restored = true; }
  } catch { /* ignorer */ }
  if (!G.pin) G.pin = makePin();

  // To kanaler: «ut» (læreren → alle elever) og «inn» (elever → bare læreren).
  ch = backend.channel(G.pin);
  inn = backend.channel(G.pin + '-inn');
  inn.on('join', onJoin);
  inn.on('answer', onAnswer);
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
  if (G.phase !== 'question' || p.qi !== G.qi || !G.players[p.id] || G.answers[p.id]) return;
  G.answers[p.id] = { value: p.value, t: Date.now() - G.qStart };
  persist();
  updateCount();
  // Alle har svart: vent litt før fasit, så meldingene ikke kommer i samme sekund.
  if (Object.keys(G.answers).length >= Object.keys(G.players).length && !allInTimer) allInTimer = setTimeout(reveal, 1200);
}

function kick(id) {
  delete G.players[id];
  delete G.answers[id];
  ch.send('kick', { id });
  persist();
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
  const st = { phase: G.phase, qi: G.qi, total: quiz ? total() : 0 };
  const cur = q();
  if (G.phase === 'intro' && cur) {
    st.startsIn = Math.max(0, (G.introEnd || 0) - Date.now());
    st.remaining = cur.time * 1000;
    st.q = { type: cur.type, labels: G.labels, maxWords: cur.maxWords, min: cur.min, max: cur.max, step: cur.step, unit: cur.unit };
  }
  if (G.phase === 'question' && cur) {
    st.remaining = Math.max(0, G.qStart + cur.time * 1000 - Date.now());
    st.q = { type: cur.type, labels: G.labels, maxWords: cur.maxWords, min: cur.min, max: cur.max, step: cur.step, unit: cur.unit };
  }
  if (['reveal', 'scoreboard', 'podium'].includes(G.phase)) {
    st.q = cur ? { type: cur.type, scored: SCORED.includes(cur.type) } : null;
    st.results = {};
    for (const r of ranked()) st.results[r.id] = { ok: r.ok, pts: r.pts, score: r.score, rank: r.rank, streak: r.streak, answered: r.answered };
  }
  return st;
}


// ---------- Gangen i spillet ----------
function next() {
  if (G.phase === 'lobby') return goTo(0);
  if (G.phase === 'question') return reveal();
  const last = G.qi >= total() - 1;
  if (G.phase === 'reveal' && quiz.settings?.leaderboard !== false && !last && SCORED.includes(q().type) && playerIds().length) {
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
  const cur = q();
  if (cur.type === 'info') { G.phase = 'info'; return commit(); }
  prepareQuestion(cur);
  G.phase = 'intro';
  G.introEnd = Date.now() + INTRO_MS;
  commit(); // mobilene får spørsmålet nå og starter selv etter «Gjør deg klar»
  introTimer = setTimeout(startQuestion, INTRO_MS);
}

function prepareQuestion(cur) {
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

function reveal() {
  clearTimeout(allInTimer);
  allInTimer = null;
  if (G.phase !== 'question') return;
  clearInterval(tick);
  const cur = q();
  const scored = SCORED.includes(cur.type);
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
  const qsAll = quiz.questions.map((x, i) => ({ q: playable(x), i })).filter(x => x.q.type !== 'info');
  const head = [t('res.place'), t('res.name'), t('res.score'), t('res.correct'),
    ...qsAll.map(x => `${x.i + 1}. ${(x.q.text || t('type.' + x.q.type)).replace(/\s+/g, ' ').slice(0, 60)}`)];
  const rows = ranked().map(p => {
    const hist = p.history || {};
    const nOk = Object.values(hist).filter(h => h.ok).length;
    return [p.rank, p.name, p.score, nOk, ...qsAll.map(x => {
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
  setTimeout(() => { location.href = 'laerer.html'; }, 300);
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
    G.phase !== 'lobby' ? h('span', { class: 'hbar-pin' }, joinHost() + ' · ' + t('host.pin') + ' ', h('b', null, G.pin)) : null,
    h('span', { class: 'spacer' }),
    h('span', { class: 'hbar-count' }, icon('user'), h('span', { class: 'hbar-n' }, playerIds().length)),
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
  ({ lobby: renderLobbyInto, intro: renderIntro, question: renderQuestion, info: renderInfo, reveal: renderReveal, scoreboard: renderScoreboard, podium: renderPodium })[G.phase](main);
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
  put(main, 
    h('section', { class: 'lobby-top' },
      h('div', { class: 'lobby-join' },
        h('h1', { class: 'lobby-title' }, quiz.title),
        h('p', { class: 'lobby-at' }, t('host.joinAt'), ' ', h('b', null, joinHost())),
        h('div', { class: 'lobby-pin' }, h('span', null, t('host.pin')), h('strong', null, G.pin.slice(0, 3) + ' ' + G.pin.slice(3))),
        h('p', { class: 'lobby-scan' }, t('host.orScan'))),
      h('div', { class: 'lobby-qr' }, qrSvg(joinUrl()))),
    h('section', { class: 'lobby-players' },
      h('div', { class: 'lobby-bar' },
        h('span', { class: 'lobby-count' }, t('host.players', { n: ids.length })),
        ids.length ? h('span', { class: 'muted' }, t('host.kickHint')) : null,
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn ghost', onclick: () => { G.locked = !G.locked; persist(); render(); } }, G.locked ? [icon('lock'), t('host.unlock')] : [icon('unlock'), t('host.lock')]),
        h('button', { class: 'btn primary big', onclick: next }, t('host.start'))),
      ids.length
        ? h('div', { class: 'chips' + (ids.length > 30 ? ' many' : '') }, ids.map(id => {
          const isNew = !shownChips.has(id);
          shownChips.add(id);
          return h('button', { class: 'chip' + (isNew ? ' new' : ''), onclick: () => kick(id) }, G.players[id].name);
        }))
        : h('p', { class: 'waiting' }, h('span', { class: 'spinner small' }), t('host.waiting'))));
}

function audioPlayer(cur, autoplay) {
  if (!cur.audio) return null;
  const el = h('audio', { src: cur.audio, controls: true, preload: 'auto' });
  if (autoplay && cur.autoplay !== false) setTimeout(() => el.play().catch(() => {}), 150);
  return h('div', { class: 'audio-box' }, h('span', { class: 'audio-icon' }, icon('sound', 26)), el);
}

function questionHead(cur) {
  return h('div', { class: 'qhead' },
    h('span', { class: 'qhead-mark' }, questionSvg(54)),
    h('div', null,
      h('div', { class: 'qhead-n' }, t('host.question', { n: G.qi + 1, total: total() })),
      h('h1', { class: 'qhead-text' + (cur.text.length > 120 ? ' long' : '') }, cur.text)));
}

function renderIntro(main) {
  const cur = q();
  put(main, h('div', { class: 'intro' },
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
        h('button', { class: 'btn ghost small', onclick: reveal }, t('host.skip')))),
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
    body = h('div', { class: 'reveal-wrap' },
      h('div', { class: 'reveal-top' + (cur.image ? ' with-img' : '') },
        cur.image ? h('img', { class: 'qimg small', src: cur.image, alt: '' }) : null,
        bars(cur, counts, correct)),
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
  put(main, h('div', { class: 'reveal-body' }, body), audioPlayer(cur, false));
  put(main, h('div', { class: 'hfoot' },
    SCORED.includes(cur.type) ? h('span', { class: 'reveal-stat' }, t('host.correctCount', { n: nCorrect, total: nPlayers })) : h('span', null),
    h('button', { class: 'btn primary big', onclick: next }, G.qi >= total() - 1 ? t('host.podium') : t('host.next'))));
}

function bars(cur, counts, correct) {
  const max = Math.max(1, ...counts);
  return h('div', { class: 'bars' }, counts.map((c, i) => {
    const ci = colorIndex(cur.type, i);
    return h('div', { class: 'bar-col' + (correct && !correct[i] ? ' dim' : '') },
      h('div', { class: 'bar-n' }, correct?.[i] ? '✓ ' : '', c),
      h('div', { class: 'bar-area' }, h('div', { class: 'bar', style: { height: Math.max(3, c / max * 100) + '%', background: COLORS[ci] } })),
      h('div', { class: 'bar-shape', style: { background: COLORS[ci] } }, svg(SHAPES[ci])));
  }));
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

function renderScoreboard(main) {
  const top = ranked().slice(0, 5);
  const max = Math.max(1, ...top.map(p => p.score));
  put(main, h('h1', { class: 'board-title' }, t('host.scoreboard')),
    h('ol', { class: 'board' }, top.map((p, i) => h('li', { style: { animationDelay: i * 90 + 'ms' } },
      h('span', { class: 'board-rank' }, p.rank),
      h('span', { class: 'board-name' }, p.name, p.streak > 1 ? h('span', { class: 'board-streak' }, ' 🔥' + p.streak) : null),
      h('span', { class: 'board-bar' }, h('span', { style: { width: (p.score / max * 100) + '%' } })),
      h('span', { class: 'board-score' }, p.score, p.pts ? h('small', null, ' +' + p.pts) : null)))),
    h('div', { class: 'hfoot' }, h('span', null), h('button', { class: 'btn primary big', onclick: next }, t('host.next'))));
}

function renderPodium(main) {
  const all = ranked();
  const [first, second, third] = all;
  const step = (p, place, cls) => h('div', { class: 'pod ' + cls },
    p ? h('div', { class: 'pod-name' }, p.name) : h('div', { class: 'pod-name muted' }, '–'),
    p ? h('div', { class: 'pod-score' }, p.score) : null,
    h('div', { class: 'pod-block' }, place === 1 ? exclamationSvg(70) : null, h('span', { class: 'pod-place' }, place)));
  put(main, 
    h('h1', { class: 'board-title' }, all.length ? t('host.podium') : t('host.nobody')),
    h('div', { class: 'podium' }, step(second, 2, 'second'), step(first, 1, 'first'), step(third, 3, 'third')),
    all.length > 3 ? h('details', { class: 'all-results' }, h('summary', null, t('host.allResults')),
      h('ol', null, all.slice(3).map(p => h('li', { value: p.rank }, h('span', null, p.name), h('b', null, p.score))))) : null,
    h('div', { class: 'hfoot' },
      all.length ? h('button', { class: 'btn ghost', onclick: downloadResults }, [icon('download'), t('res.download')]) : h('span', null),
      h('button', { class: 'btn primary big', onclick: endGame }, t('host.end'))));
  if (first) confetti();
}

function confetti() {
  const box = h('div', { class: 'confetti', 'aria-hidden': 'true' });
  const colors = ['#FFD23F', '#FF8A1F', '#D62839', '#1F5FD1', '#1E8B3A', '#7A3BD9'];
  for (let i = 0; i < 90; i++) {
    box.append(h('i', { style: { left: Math.random() * 100 + '%', background: colors[i % colors.length], animationDelay: (Math.random() * 1.5) + 's', animationDuration: (2.5 + Math.random() * 2) + 's', transform: `rotate(${Math.random() * 360}deg)` } }));
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 6000);
}

document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea, button')) return;
  if ((e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') && ['lobby', 'reveal', 'scoreboard', 'info'].includes(G.phase)) { e.preventDefault(); next(); }
});

init();
