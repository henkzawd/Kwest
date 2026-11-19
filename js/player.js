// Elevsiden: bli med med PIN + kallenavn, og svar på mobilen.
import { h, svg, clear, uid, qs, baseUrl } from './util.js';
import { t, langButton } from './i18n.js';
import { backend } from './backend.js';
import { feedbackDialog } from './feedback.js';
import { COLORS, SHAPES, colorIndex } from './game.js';
import { wordmark, questionSvg, exclamationSvg, landscape, setFavicon } from './logo.js';

setFavicon();
const app = document.getElementById('app');

const S = {
  pin: (qs('pin') || '').replace(/\D/g, '').slice(0, 6),
  name: (() => { try { return localStorage.getItem('kwest-name') || ''; } catch { return ''; } })(),
  id: null, ch: null, joined: false, view: null, state: null,
  answeredQi: -1, myAnswer: null, score: 0, timer: null, lost: false,
};

// Gjenoppta samme spill hvis eleven laster siden på nytt.
try {
  const saved = JSON.parse(sessionStorage.getItem('kwest-player'));
  if (saved && (!S.pin || saved.pin === S.pin)) Object.assign(S, { pin: saved.pin, name: saved.name, id: saved.id });
} catch { /* ignorer */ }

function rerender() { if (S.view) S.view(); }

function frame(content, opts = {}) {
  clear(app);
  const top = opts.bar
    ? h('header', { class: 'pbar' },
        h('span', { class: 'pbar-name' }, S.name),
        S.lost ? h('span', { class: 'pbar-lost' }, t('play.lost')) : null,
        h('span', { class: 'pbar-score' }, t('play.score', { n: S.score })))
    : h('header', { class: 'ptop' }, opts.hero ? h('span') : wordmark(34), langButton(rerender));
  app.append(top, h('main', { class: 'pmain ' + (opts.cls || '') }, content));
  if (!opts.bar) app.append(h('div', { class: 'landscape', 'aria-hidden': 'true' }, landscape()));
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
      h('a', { class: 'teacher-link', href: 'laerer.html' }, t('join.teacher')),
      h('button', { class: 'link teacher-link', type: 'button', onclick: () => feedbackDialog(null, 'elev') }, t('fb.button')))), { cls: 'center', hero: true });
  setTimeout(() => input.focus(), 50);
}

function message(title, sub, opts = {}) {
  S.view = () => message(title, sub, opts);
  frame(h('div', { class: 'pmsg' },
    opts.icon || null,
    h('h1', null, typeof title === 'function' ? title() : title),
    sub ? h('p', null, typeof sub === 'function' ? sub() : sub) : null,
    opts.button || null), { bar: opts.bar !== false && S.joined, cls: 'center ' + (opts.cls || '') });
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
    if (p.answered && p.state) S.answeredQi = p.state.qi;
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
  frame(h('div', { class: 'pmsg lobby' },
    h('div', { class: 'big-mark' }, exclamationSvg(110)),
    h('div', { class: 'banner' }, S.name),
    h('h1', null, t('join.youreIn')),
    h('p', null, t('join.seeName'))), { cls: 'center' });
}

// ---------- Spillet ----------
function onState(st) {
  // Samme lobby-status på nytt (fordi andre ble med) – ikke tegn skjermen på nytt.
  if (st.phase === 'lobby' && S.state?.phase === 'lobby' && S.view === lobby) { S.state = st; return; }
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
      return message(() => t('play.getReady'), () => t('play.question', { n: st.qi + 1, total: st.total }), { icon: h('div', { class: 'big-mark pulse' }, questionSvg(110)) });
    case 'info': return message(() => t('play.lookScreen'), null, { icon: h('div', { class: 'big-mark' }, questionSvg(90)) });
    case 'question':
      if (S.answeredQi === st.qi) return sent();
      return answerView(st);
    case 'reveal': return resultView(st);
    case 'scoreboard': return rankView(st);
    case 'podium': return finalView(st);
  }
}

function sendAnswer(value) {
  if (S.answeredQi === S.state.qi) return;
  S.answeredQi = S.state.qi;
  S.myAnswer = value;
  S.inbox?.send('answer', { id: S.id, qi: S.state.qi, value });
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
    const picked = [];
    const grid = h('div', { class: 'pgrid n' + q.labels.length });
    const sendBtn = h('button', { class: 'btn primary', disabled: true, onclick: () => sendAnswer(picked.slice()) }, t('play.send'));
    const draw = () => {
      clear(grid);
      q.labels.forEach((label, i) => {
        const pos = picked.indexOf(i);
        grid.append(h('button', {
          class: 'pbtn' + (pos >= 0 ? ' picked' : ''), style: { background: COLORS[i] },
          // Trykk igjen på et valgt svar for å fjerne det (de etter rykker opp).
          onclick: () => { if (pos < 0) picked.push(i); else picked.splice(pos, 1); draw(); },
        }, pos >= 0 ? h('span', { class: 'order-num' }, pos + 1) : h('span', { class: 'shape' }, svg(SHAPES[i])),
        h('span', { class: 'pbtn-text', style: { fontSize: fitSize(label) } }, label)));
      });
      sendBtn.disabled = picked.length !== q.labels.length;
    };
    draw();
    body = h('div', { class: 'order-wrap' }, h('p', { class: 'order-hint' }, t('play.orderHint')), grid,
      h('div', { class: 'order-actions' }, h('button', { class: 'btn ghost', onclick: () => { picked.length = 0; draw(); } }, t('play.undo')), sendBtn));
  }
  const deadline = Date.now() + (st.remaining || 0);
  const timeEl = h('span', { class: 'ptime' });
  const tick = () => { timeEl.textContent = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); };
  tick();
  S.timer = setInterval(tick, 250);
  frame(h('div', { class: 'answer-wrap' }, h('div', { class: 'pq-head' }, h('span', null, t('play.question', { n: st.qi + 1, total: st.total })), timeEl), body), { bar: true, cls: 'answering' });
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
  if (!r || !scored) {
    return message(() => (r?.answered ? t('play.thanks') : t('play.lookScreen')), null, { icon: h('div', { class: 'big-mark' }, questionSvg(90)) });
  }
  S.view = () => resultView(st);
  const cls = r.ok ? 'good' : 'bad';
  frame(h('div', { class: 'result ' + cls },
    h('div', { class: 'result-icon' }, r.ok ? '✓' : '✕'),
    h('h1', null, r.ok ? t('play.correct') : r.answered ? t('play.wrong') : t('play.noAnswer')),
    r.ok && r.pts ? h('div', { class: 'result-pts' }, t('play.points', { n: r.pts })) : null,
    r.ok && r.streak > 1 ? h('div', { class: 'result-streak' }, t('play.streak', { n: r.streak })) : null,
    h('p', { class: 'result-rank' }, t('play.place', { n: r.rank }))), { bar: true, cls: 'full' });
}

function rankView(st) {
  const r = st.results?.[S.id];
  message(() => (r ? t('play.place', { n: r.rank }) : t('play.lookScreen')), () => (r ? t('play.finalScore', { n: r.score }) : ''), { icon: h('div', { class: 'big-mark' }, questionSvg(90)) });
}

function finalView(st) {
  const r = st.results?.[S.id];
  S.view = () => finalView(st);
  const medal = r && r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : null;
  frame(h('div', { class: 'pmsg final' },
    medal ? h('div', { class: 'medal' }, medal) : h('div', { class: 'big-mark' }, questionSvg(100)),
    h('div', { class: 'banner' }, t('play.final')),
    r ? h('p', { class: 'final-place' }, t('play.finalPlace', { n: r.rank })) : null,
    r ? h('p', null, t('play.finalScore', { n: r.score })) : null,
    againButton()), { bar: true, cls: 'center' });
  sessionStorage.removeItem('kwest-player');
}

// Start
if (backend.mode === 'demo') { document.body.classList.add('is-demo'); document.body.append(h('div', { class: 'demo-banner' }, t('demo.banner'))); }
if (S.pin && S.name && S.id) connect();
else joinView();
