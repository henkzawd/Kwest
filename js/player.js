// Elevsiden: bli med med PIN + kallenavn, og svar på mobilen.
import { h, svg, clear, uid, qs, baseUrl } from './util.js';
import { t, langButton } from './i18n.js';
import { backend } from './backend.js';
import { feedbackDialog } from './feedback.js';
import { COLORS, SHAPES, TEAM_COLORS, REACTIONS, colorIndex } from './game.js';
import { wordmark, questionSvg, exclamationSvg, landscape, setFavicon } from './logo.js';

setFavicon();
const app = document.getElementById('app');

const S = {
  pin: (qs('pin') || '').replace(/\D/g, '').slice(0, 6),
  name: (() => { try { return localStorage.getItem('kwest-name') || ''; } catch { return ''; } })(),
  id: null, ch: null, joined: false, view: null, state: null,
  answered: '', myAnswer: null, score: 0, timer: null, lost: false,
};
// Et svar gjelder ett spørsmål i én runde («stem igjen» gir runde 2).
const akey = st => st.qi + ':' + (st.round || 1);
function myTeam() {
  const i = S.state?.teams?.of?.[S.id];
  return i === undefined ? null : { i, name: t('team.' + i), color: TEAM_COLORS[i] };
}

// Gjenoppta samme spill hvis eleven laster siden på nytt.
try {
  const saved = JSON.parse(sessionStorage.getItem('kwest-player'));
  if (saved && (!S.pin || saved.pin === S.pin)) Object.assign(S, { pin: saved.pin, name: saved.name, id: saved.id });
} catch { /* ignorer */ }

function rerender() { if (S.view) S.view(); }

function frame(content, opts = {}) {
  clear(app);
  const team = opts.bar ? myTeam() : null;
  const top = opts.bar
    ? h('header', { class: 'pbar' },
        h('span', { class: 'pbar-name' }, S.name),
        team ? h('span', { class: 'pbar-team', style: { background: team.color } }, team.name) : null,
        S.lost ? h('span', { class: 'pbar-lost' }, t('play.lost')) : null,
        h('span', { class: 'pbar-score' }, t('play.score', { n: S.score })))
    : h('header', { class: 'ptop' }, opts.hero ? h('span') : wordmark(34), langButton(rerender));
  app.append(top, h('main', { class: 'pmain ' + (opts.cls || '') }, content));
  if (opts.react) { const bar = reactBar(); if (bar) app.append(bar); }
  if (!opts.bar) app.append(h('div', { class: 'landscape', 'aria-hidden': 'true' }, landscape()));
}

// ---------- Reaksjoner: 🐐 og ⛰️ til storskjermen ----------
// Trykkene samles og sendes høyst hvert 8. sekund, så storskjermen ikke får for mange meldinger.
const REACT_GAP = 8000;
const R = { queue: { g: 0, p: 0 }, last: 0, timer: null };
function reactBar() {
  if (!S.joined || S.state?.rx === false) return null;
  return h('div', { class: 'react-bar' }, Object.entries(REACTIONS).map(([k, emoji]) =>
    h('button', { class: 'react-btn', type: 'button', 'aria-label': emoji, onclick: e => tapReact(k, emoji, e.currentTarget) }, emoji)));
}
function tapReact(k, emoji, btn) {
  if (R.queue[k] >= 5) return;
  R.queue[k]++;
  const pop = h('span', { class: 'react-pop', 'aria-hidden': 'true' }, emoji);
  btn.append(pop);
  setTimeout(() => pop.remove(), 900);
  if (navigator.vibrate) navigator.vibrate(8);
  if (R.timer) return;
  R.timer = setTimeout(flushReact, Math.max(0, R.last + REACT_GAP - Date.now()));
}
function flushReact() {
  R.timer = null;
  if (!S.joined || (!R.queue.g && !R.queue.p)) return;
  R.last = Date.now();
  S.inbox?.send('react', { id: S.id, ...R.queue });
  R.queue = { g: 0, p: 0 };
}

// ---------- Bli med ----------
function joinView(error = '') {
  S.view = () => joinView(error);
  const needPin = !S.pin;
  const input = needPin
    ? h('input', { class: 'big-input', inputmode: 'numeric', autocomplete: 'off', maxlength: '6', placeholder: t('join.pinPh'), 'aria-label': t('join.pin') })
    : h('input', { class: 'big-input', autocomplete: 'off', maxlength: '15', placeholder: t('join.namePh'), 'aria-label': t('join.name'), value: S.name });
  const msg = h('p', { class: 'form-error', role: 'alert' }, error);
  const submit = e => {
    e.preventDefault();
    const v = input.value.trim();
    if (needPin) {
      const pin = v.replace(/\D/g, '');
      if (pin.length !== 6) { msg.textContent = t('join.needPin'); return; }
      S.pin = pin;
      joinView();
    } else {
      if (!v) { msg.textContent = t('join.needName'); return; }
      S.name = v.slice(0, 15);
      try { localStorage.setItem('kwest-name', S.name); } catch { /* ignorer */ }
      connect();
    }
  };
  frame(h('div', { class: 'join-card' },
    h('div', { class: 'hero' }, exclamationSvg(96), h('span', { class: 'hero-name' }, 'Kwest')),
    !needPin ? h('button', { class: 'pin-chip', type: 'button', onclick: () => { S.pin = ''; joinView(); } }, t('join.pin') + ': ' + S.pin + ' ✎') : null,
    h('form', { onsubmit: submit, class: 'join-form' },
      h('label', { class: 'join-label' }, needPin ? t('join.pin') : t('join.name')),
      input,
      msg,
      h('button', { class: 'btn primary huge', type: 'submit' }, needPin ? t('join.next') : t('join.go'))),
    h('div', { class: 'join-links' },
      h('a', { class: 'teacher-link', href: 'studio.html' }, t('join.teacher')),
      h('button', { class: 'link teacher-link', type: 'button', onclick: () => feedbackDialog(null, 'elev') }, t('fb.button')))), { cls: 'center', hero: true });
  setTimeout(() => input.focus(), 50);
}

function message(title, sub, opts = {}) {
  S.view = () => message(title, sub, opts);
  frame(h('div', { class: 'pmsg' },
    opts.icon || null,
    h('h1', null, typeof title === 'function' ? title() : title),
    sub ? h('p', null, typeof sub === 'function' ? sub() : sub) : null,
    opts.extra || null,
    opts.button || null), { bar: opts.bar !== false && S.joined, cls: 'center ' + (opts.cls || ''), react: opts.react });
}

// Diskuter med sidemannen: vis hva eleven svarte, men ikke fasit.
function discussView(st) {
  const labels = st.q?.type === 'truefalse' ? [t('ed.true'), t('ed.false')] : st.q?.labels;
  const mine = typeof S.myAnswer === 'number' && S.answered === st.qi + ':1' ? labels?.[S.myAnswer] : null;
  const ci = mine !== null && mine !== undefined ? colorIndex(st.q.type, S.myAnswer) : null;
  message(() => t('play.discuss'), () => t('play.discussText'), {
    icon: h('div', { class: 'big-mark' }, '💬'),
    extra: mine ? h('div', { class: 'my-answer', style: { background: COLORS[ci] } }, h('small', null, t('play.youAnswered')), h('b', null, mine)) : null,
    react: true,
  });
}

// ---------- Tilkobling ----------
function connect() {
  S.id ||= uid();
  message(() => t('join.connecting'), null, { icon: h('div', { class: 'spinner' }), bar: false });
  if (S.ch) S.ch.close();
  const ch = backend.channel(S.pin);
  S.ch = ch;
  S.inbox = backend.inbox(S.pin + '-inn');
  let notFoundTimer = setTimeout(() => {
    if (!S.joined) { S.ch?.close(); S.ch = null; S.pin = ''; sessionStorage.removeItem('kwest-player'); joinView(t('join.notFound')); }
  }, 6000);

  // Storskjermen sender én samlet melding: status for spillet + svar til de som nettopp ble med.
  ch.on('state', msg => {
    const p = msg.replies?.[S.id];
    if (!p) { if (S.joined) onState(msg); return; }
    p.state = msg;
    clearTimeout(notFoundTimer);
    if (!p.ok) {
      ch.close(); S.ch = null; S.joined = false;
      sessionStorage.removeItem('kwest-player');
      if (p.error === 'taken') { S.id = uid(); return joinView(t('join.taken')); }
      return joinView(t('join.locked'));
    }
    S.joined = true;
    S.score = p.score || 0;
    if (p.answered && p.state) S.answered = akey(p.state);
    sessionStorage.setItem('kwest-player', JSON.stringify({ pin: S.pin, name: S.name, id: S.id }));
    keepAwake();
    onState(p.state);
  });
  ch.on('kick', p => {
    if (p.id !== S.id) return;
    leave();
    message(() => t('play.kicked'), null, { bar: false, button: againButton() });
  });
  ch.on('end', () => {
    if (S.state?.phase === 'podium') return; // behold resultatet på skjermen
    leave();
    message(() => t('play.ended'), null, { bar: false, button: againButton() });
  });
  ch.subscribe(status => {
    if (status === 'SUBSCRIBED') {
      S.lost = false;
      S.inbox.send('join', { id: S.id, name: S.name });
      if (S.joined) rerender();
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      if (S.joined && S.ch === ch) { S.lost = true; rerender(); }
    }
  });
}

function leave() {
  S.ch?.close(); S.ch = null; S.joined = false; S.state = null;
  sessionStorage.removeItem('kwest-player');
}

function againButton() {
  return h('button', { class: 'btn primary', onclick: () => { location.href = baseUrl(); } }, t('play.again'));
}

let wakeLock = null;
async function keepAwake() {
  try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch { /* ikke støttet */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.joined) {
    keepAwake();
    S.inbox?.send('join', { id: S.id, name: S.name }); // be om oppdatert status
  }
});

function lobby() {
  S.view = lobby;
  const team = myTeam();
  frame(h('div', { class: 'pmsg lobby' },
    h('div', { class: 'big-mark' }, exclamationSvg(110)),
    h('div', { class: 'banner' }, S.name),
    team ? h('div', { class: 'team-badge', style: { background: team.color } }, t('play.yourTeam', { name: team.name })) : null,
    h('h1', null, t('join.youreIn')),
    h('p', null, t('join.seeName'))), { cls: 'center', react: true });
}

// ---------- Spillet ----------
function onState(st) {
  // Samme lobby-status på nytt (fordi andre ble med) – ikke tegn skjermen på nytt.
  if (st.phase === 'lobby' && S.state?.phase === 'lobby' && S.view === lobby && st.rx === S.state.rx
    && st.teams?.of?.[S.id] === S.state.teams?.of?.[S.id] && !!st.teams === !!S.state.teams) { S.state = st; return; }
  const prevQi = S.state?.qi;
  S.state = st;
  if (st.qi !== prevQi && st.phase !== 'reveal') S.myAnswer = null;
  const me = st.results?.[S.id];
  if (me) S.score = me.score;
  clearInterval(S.timer);
  clearTimeout(S.introTimer);
  switch (st.phase) {
    case 'lobby': return lobby();
    case 'intro':
      // Spørsmålet starter av seg selv når «Gjør deg klar» er ferdig (sparer en melding per spørsmål).
      if (st.q) S.introTimer = setTimeout(() => { if (S.state === st) onState({ ...st, phase: 'question' }); }, st.startsIn || 0);
      if (st.round === 2) return message(() => t('play.revote'), () => t('play.revoteText'), { icon: h('div', { class: 'big-mark pulse' }, '💬') });
      if (st.q?.finale) return message(() => t('play.finale'), () => t('play.finaleText'), { icon: h('div', { class: 'big-mark pulse' }, questionSvg(110)), cls: 'finale' });
      return message(() => t('play.getReady'), () => t('play.question', { n: st.qi + 1, total: st.total }), { icon: h('div', { class: 'big-mark pulse' }, questionSvg(110)) });
    case 'info': return message(() => t('play.lookScreen'), null, { icon: h('div', { class: 'big-mark' }, questionSvg(90)) });
    case 'question':
      if (S.answered === akey(st)) return sent();
      return answerView(st);
    case 'discuss': return discussView(st);
    case 'reveal': return resultView(st);
    case 'scoreboard': return rankView(st);
    case 'podium': return finalView(st);
  }
}

function sendAnswer(value) {
  if (S.answered === akey(S.state)) return;
  S.answered = akey(S.state);
  S.myAnswer = value;
  S.inbox?.send('answer', { id: S.id, qi: S.state.qi, round: S.state.round || 1, value });
  if (navigator.vibrate) navigator.vibrate(30);
  sent();
}

function sent() {
  message(() => t('play.sent'), () => t('play.waitOthers'), { icon: h('div', { class: 'spinner' }) });
}

function answerView(st) {
  S.view = () => answerView(st);
  const q = st.q;
  let body;
  if (q.type === 'quiz' || q.type === 'poll' || q.type === 'truefalse') {
    const labels = q.type === 'truefalse' ? [t('ed.true'), t('ed.false')] : q.labels;
    body = h('div', { class: 'pgrid n' + labels.length },
      labels.map((label, i) => h('button', {
        class: 'pbtn', style: { background: COLORS[colorIndex(q.type, i)] },
        onclick: () => sendAnswer(i),
      }, h('span', { class: 'shape' }, svg(SHAPES[colorIndex(q.type, i)])), h('span', { class: 'pbtn-text', style: { fontSize: fitSize(label) } }, label))));
  } else if (q.type === 'short') {
    const inp = h('input', { class: 'big-input', maxlength: '60', autocomplete: 'off', autocapitalize: 'off', placeholder: t('play.typeHere') });
    body = h('form', { class: 'ptext', onsubmit: e => { e.preventDefault(); if (inp.value.trim()) sendAnswer(inp.value.trim()); } },
      inp, h('button', { class: 'btn primary huge', type: 'submit' }, t('play.send')));
    setTimeout(() => inp.focus(), 50);
  } else if (q.type === 'wordcloud') {
    const inputs = Array.from({ length: q.maxWords || 1 }, (_, i) => h('input', { class: 'big-input', maxlength: '25', autocomplete: 'off', placeholder: q.maxWords > 1 ? t('play.wordHere', { n: i + 1 }) : t('play.typeHere') }));
    body = h('form', { class: 'ptext', onsubmit: e => {
      e.preventDefault();
      const words = inputs.map(i => i.value.trim()).filter(Boolean);
      if (words.length) sendAnswer(words);
    } }, inputs, h('button', { class: 'btn primary huge', type: 'submit' }, t('play.send')));
    setTimeout(() => inputs[0].focus(), 50);
  } else if (q.type === 'slider') {
    const mid = q.min + Math.round((q.max - q.min) / 2 / q.step) * q.step;
    const out = h('div', { class: 'slider-value' });
    const decimals = (String(q.step).split('.')[1] || '').length;
    const show = () => { out.textContent = Number(range.value).toFixed(decimals) + (q.unit ? ' ' + q.unit : ''); };
    const range = h('input', { type: 'range', class: 'big-range', min: q.min, max: q.max, step: q.step, value: mid, oninput: show });
    show();
    body = h('div', { class: 'ptext' }, out, range,
      h('div', { class: 'range-ends' }, h('span', null, q.min), h('span', null, q.max)),
      h('button', { class: 'btn primary huge', onclick: () => sendAnswer(Number(range.value)) }, t('play.send')));
  } else if (q.type === 'order') {
    body = dragList(q);
  }
  const deadline = Date.now() + (st.remaining || 0);
  const timeEl = h('span', { class: 'ptime' });
  const tick = () => { timeEl.textContent = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); };
  tick();
  S.timer = setInterval(tick, 250);
  frame(h('div', { class: 'answer-wrap' }, h('div', { class: 'pq-head' }, h('span', null, t('play.question', { n: st.qi + 1, total: st.total })), timeEl), body), { bar: true, cls: 'answering' });
}

// Rekkefølge: eleven drar feltene opp og ned. Plassnummeret (1 = øverst = først) står i hjørnet.
function dragList(q) {
  const order = q.labels.map((_, i) => i); // visningsindekser, øverst først
  const list = h('div', { class: 'drag-list' });
  const rows = q.labels.map((label, i) => h('div', { class: 'drag-row', style: { background: COLORS[i] } },
    h('span', { class: 'drag-pos' }),
    h('span', { class: 'drag-text', style: { fontSize: fitSize(label) } }, label),
    h('span', { class: 'drag-handle', 'aria-hidden': 'true' }, svg('<svg viewBox="0 0 20 20" width="22" height="22"><g fill="currentColor"><circle cx="7" cy="5" r="1.6"/><circle cx="13" cy="5" r="1.6"/><circle cx="7" cy="10" r="1.6"/><circle cx="13" cy="10" r="1.6"/><circle cx="7" cy="15" r="1.6"/><circle cx="13" cy="15" r="1.6"/></g></svg>'))));
  const layout = () => order.forEach((d, pos) => { list.append(rows[d]); rows[d].querySelector('.drag-pos').textContent = pos + 1; });
  layout();

  // Flytt et felt og la de andre gli pent på plass (FLIP-animasjon).
  const moveTo = (d, target) => {
    const before = new Map(rows.map(r => [r, r.getBoundingClientRect().top]));
    order.splice(order.indexOf(d), 1);
    order.splice(target, 0, d);
    layout();
    rows.forEach(r => {
      if (r === rows[d]) return;
      const dy = before.get(r) - r.getBoundingClientRect().top;
      if (!dy) return;
      r.style.transition = 'none';
      r.style.transform = `translateY(${dy}px)`;
      requestAnimationFrame(() => { r.style.transition = 'transform .18s ease'; r.style.transform = ''; });
    });
  };

  let drag = null;
  rows.forEach((row, d) => {
    row.addEventListener('pointerdown', e => {
      e.preventDefault();
      row.setPointerCapture(e.pointerId);
      const step = rows.length > 1 ? Math.abs(rows[order[1]].getBoundingClientRect().top - rows[order[0]].getBoundingClientRect().top) : 1;
      drag = { d, row, startY: e.clientY, step };
      row.style.transition = 'none';
      row.classList.add('dragging');
    });
    row.addEventListener('pointermove', e => {
      if (!drag || drag.row !== row) return;
      let dy = e.clientY - drag.startY;
      const pos = order.indexOf(d);
      const target = Math.max(0, Math.min(order.length - 1, pos + Math.round(dy / drag.step)));
      if (target !== pos) {
        moveTo(d, target);
        drag.startY += (target - pos) * drag.step;
        dy = e.clientY - drag.startY;
      }
      row.style.transform = `translateY(${dy}px)`;
    });
    const end = () => {
      if (!drag || drag.row !== row) return;
      drag = null;
      row.classList.remove('dragging');
      row.style.transition = 'transform .18s ease';
      row.style.transform = '';
      if (navigator.vibrate) navigator.vibrate(10);
    };
    row.addEventListener('pointerup', end);
    row.addEventListener('pointercancel', end);
  });

  return h('div', { class: 'order-wrap' },
    h('p', { class: 'order-hint' }, t('play.orderHint')),
    list,
    h('button', { class: 'btn primary huge', onclick: () => sendAnswer(order.slice()) }, t('play.send')));
}

function fitSize(text) {
  const n = String(text).length;
  // Lange enkeltord (f.eks. «Organsystem») skal få plass uten å deles midt i ordet.
  const longest = Math.max(0, ...String(text).split(/\s+/).map(w => w.length));
  const byLength = n > 80 ? 0.95 : n > 50 ? 1.1 : n > 25 ? 1.35 : 1.7;
  const byWord = longest > 14 ? 0.95 : longest > 11 ? 1.1 : longest > 8 ? 1.25 : 1.7;
  return Math.min(byLength, byWord) + 'rem';
}

function resultView(st) {
  const r = st.results?.[S.id];
  const scored = st.q && st.q.scored;
  const exp = (st.q?.explanation || '').trim();
  // Forklaringsboksen vises bare når læreren har skrevet noe.
  const expBox = exp ? h('div', { class: 'exp-panel' },
    h('b', null, svg('<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 21.5V5.5"/></svg>'), t('play.explanation')),
    h('p', null, exp)) : null;
  S.view = () => resultView(st);
  if (!r || !scored) {
    if (!expBox) return message(() => (r?.answered ? t('play.thanks') : t('play.lookScreen')), null, { icon: h('div', { class: 'big-mark' }, questionSvg(90)), react: true });
    return frame(h('div', { class: 'result-stack' },
      h('div', { class: 'result neutral' }, h('h1', null, r?.answered ? t('play.thanks') : t('play.lookScreen'))), expBox), { bar: true, cls: 'full', react: true });
  }
  const cls = r.ok ? 'good' : 'bad';
  const correctText = st.q.tf !== undefined ? (st.q.tf ? t('ed.true') : t('ed.false')) : st.q.correct;
  frame(h('div', { class: 'result-stack' + (expBox ? ' with-exp' : '') },
    h('div', { class: 'result ' + cls },
      h('div', { class: 'result-icon' }, r.ok ? '✓' : '✕'),
      h('h1', null, r.ok ? t('play.correct') : r.answered ? t('play.wrong') : t('play.noAnswer')),
      r.ok && r.pts ? h('div', { class: 'result-pts' }, t('play.points', { n: r.pts })) : null,
      r.ok && r.streak > 1 ? h('div', { class: 'result-streak' }, t('play.streak', { n: r.streak })) : null,
      !r.ok && correctText ? h('p', { class: 'result-correct' }, t('play.correctWas'), ' ', h('b', null, correctText)) : null,
      r.climb ? h('div', { class: 'result-climb' }, t('play.climb', { n: r.climb })) : null,
      h('p', { class: 'result-rank' }, t('play.place', { n: r.rank }), r.tr ? ' · ' + t('play.teamPlace', { n: r.tr }) : '')),
    expBox), { bar: true, cls: 'full', react: true });
}

function rankView(st) {
  const r = st.results?.[S.id];
  message(() => (r ? t('play.place', { n: r.rank }) : t('play.lookScreen')), () => (r ? t('play.finalScore', { n: r.score }) + (r.tr ? ' · ' + t('play.teamPlace', { n: r.tr }) : '') : ''),
    { icon: h('div', { class: 'big-mark' }, questionSvg(90)), react: true });
}

function finalView(st) {
  const r = st.results?.[S.id];
  S.view = () => finalView(st);
  const medal = r && r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : null;
  frame(h('div', { class: 'pmsg final' },
    medal ? h('div', { class: 'medal' }, medal) : h('div', { class: 'big-mark' }, questionSvg(100)),
    h('div', { class: 'banner' }, t('play.final')),
    r?.tr ? h('p', { class: 'final-place' }, t('play.teamFinal', { n: r.tr })) : null,
    r ? h('p', { class: r.tr ? '' : 'final-place' }, t('play.finalPlace', { n: r.rank })) : null,
    r ? h('p', null, t('play.finalScore', { n: r.score })) : null,
    againButton()), { bar: true, cls: 'center', react: true });
  sessionStorage.removeItem('kwest-player');
}

// Start
if (backend.mode === 'demo') { document.body.classList.add('is-demo'); document.body.append(h('div', { class: 'demo-banner' }, t('demo.banner'))); }
if (S.pin && S.name && S.id) connect();
else joinView();
