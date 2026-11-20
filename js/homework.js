// Hjemmelekse: eleven tar et kwest alene på mobilen, i sitt eget tempo, uten navn.
// Til slutt sendes bare anonyme svar (riktig/galt og svaret) til læreren.
import { h, svg, shuffle } from './util.js';
import { t } from './i18n.js';
import { backend } from './backend.js';
import { SCORED, playable, judge, basePoints } from './game.js';
import { exclamationSvg, questionSvg } from './logo.js';

let ui = null;
const H = { code: '', title: '', questions: [], settings: {}, i: 0, score: 0, answers: [], nOk: 0, nScored: 0, submitted: false };

export async function startHomework(code, helpers) {
  ui = helpers;
  H.code = String(code).replace(/[^a-z0-9]/gi, '').slice(0, 20);
  show(() => h('div', { class: 'pmsg' }, h('div', { class: 'spinner' })));
  let a = null;
  try { a = await backend.getAssignment(H.code); } catch { /* vises som «fant ikke» */ }
  if (!a) return show(() => msg(exclamationSvg(80), t('hw.notFound'), t('hw.notFoundText')));
  if (!a.open) return show(() => msg(exclamationSvg(80), t('hw.closed'), t('hw.closedText')));
  H.title = a.title || 'Kwest';
  H.settings = a.data?.settings || {};
  H.questions = (a.data?.questions || []).map(playable);
  H.answers = H.questions.map(() => null);
  H.nScored = H.questions.filter(q => SCORED.includes(q.type)).length;
  show(intro);
}

// Tegner en side og husker den, så språkknappen kan tegne den på nytt.
function show(view) {
  ui.setView(() => show(view));
  ui.frame(view(), { cls: 'center hw' });
}

function msg(icon, title, text, button) {
  return h('div', { class: 'pmsg' }, icon, h('h1', null, title), text ? h('p', null, text) : null, button || null);
}

function intro() {
  const n = H.questions.filter(q => q.type !== 'scoreboard').length;
  return h('div', { class: 'pmsg hw-intro' },
    h('div', { class: 'big-mark' }, questionSvg(100)),
    h('div', { class: 'banner' }, t('hw.tag')),
    h('h1', null, H.title),
    h('p', null, t('hw.introText', { n })),
    h('button', { class: 'btn primary huge', onclick: () => go(0) }, t('hw.start')),
    h('p', { class: 'muted small-text' }, t('hw.anon')));
}

function go(i) {
  while (i < H.questions.length && H.questions[i].type === 'scoreboard') i++;
  H.i = i;
  if (i >= H.questions.length) return finish();
  const q = H.questions[i];
  if (q.type === 'info') return show(() => infoView(q));
  // Svaralternativene stokkes som i spillet (rekkefølge-spørsmål alltid).
  let map = null, labels = null;
  const n = q.type === 'quiz' || q.type === 'poll' ? q.options.length : q.type === 'order' ? q.items.length : 0;
  if (n) {
    map = [...Array(n).keys()];
    if (q.type === 'order') { for (let k = 0; k < 10 && map.every((v, j) => v === j); k++) map = shuffle(map); }
    else if (H.settings.shuffle) map = shuffle(map);
    labels = map.map(j => (q.type === 'order' ? q.items[j] : q.options[j].text));
  }
  show(() => questionView(q, map, labels));
}

function head(q) {
  return h('div', { class: 'hw-head' },
    h('span', { class: 'muted' }, t('play.question', { n: H.i + 1, total: H.questions.length })),
    h('h2', { class: 'hw-q' }, q.text),
    q.image ? h('img', { class: 'hw-img', src: q.image, alt: '' }) : null,
    q.audio ? h('audio', { src: q.audio, controls: true, preload: 'auto' }) : null);
}

function infoView(q) {
  return h('div', { class: 'hw-card' },
    h('span', { class: 'hw-mark' }, exclamationSvg(40)),
    head(q),
    h('button', { class: 'btn primary huge', onclick: () => go(H.i + 1) }, t('host.next')));
}

function questionView(q, map, labels) {
  const pq = { type: q.type, labels, maxWords: q.maxWords, min: q.min, max: q.max, step: q.step, unit: q.unit };
  let done = false;
  const send = value => {
    if (done) return;
    done = true;
    answered(q, map, value);
  };
  return h('div', { class: 'hw-card answering' }, head(q), ui.answerBody(pq, send));
}

// Svaret som lesbar tekst (til lærerens oversikt).
function answerText(q, map, v) {
  switch (q.type) {
    case 'quiz': case 'poll': return q.options[map ? map[v] : v]?.text ?? '';
    case 'truefalse': return v === 0 ? t('ed.true') : t('ed.false');
    case 'order': return Array.isArray(v) ? v.map(d => q.items[map[d]]).join(' > ') : '';
    case 'wordcloud': return Array.isArray(v) ? v.join(', ') : String(v);
    case 'slider': return String(v) + (q.unit ? ' ' + q.unit : '');
    default: return String(v);
  }
}

function answered(q, map, value) {
  const scored = SCORED.includes(q.type);
  const ok = scored ? judge(q, value, map) : null;
  const pts = ok ? basePoints(q) : 0;
  H.score += pts;
  if (ok) H.nOk++;
  H.answers[H.i] = { ok, a: answerText(q, map, value).slice(0, 80) };
  if (navigator.vibrate) navigator.vibrate(30);
  show(() => feedback(q, ok, pts));
}

function correctText(q) {
  switch (q.type) {
    case 'quiz': return q.options.filter(o => o.correct).map(o => o.text).join(' / ');
    case 'truefalse': return q.tf ? t('ed.true') : t('ed.false');
    case 'short': return q.answers[0] || '';
    case 'slider': return q.correct + (q.unit ? ' ' + q.unit : '');
    case 'order': return q.items.join(' → ');
    default: return '';
  }
}

function feedback(q, ok, pts) {
  const exp = (q.explanation || '').trim();
  const expBox = exp ? h('div', { class: 'exp-panel' },
    h('b', null, svg('<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 21.5V5.5"/></svg>'), t('play.explanation')),
    h('p', null, exp)) : null;
  const last = H.questions.slice(H.i + 1).every(x => x.type === 'scoreboard');
  const nextBtn = h('button', { class: 'btn primary huge', onclick: () => go(H.i + 1) }, last ? t('hw.finish') : t('host.next') + ' →');
  const result = ok === null
    ? h('div', { class: 'result neutral' }, h('h1', null, t('play.thanks')))
    : h('div', { class: 'result ' + (ok ? 'good' : 'bad') },
      h('div', { class: 'result-icon' }, ok ? '✓' : '✕'),
      h('h1', null, ok ? t('play.correct') : t('play.wrong')),
      ok ? h('div', { class: 'result-pts' }, t('play.points', { n: pts })) : h('p', { class: 'result-correct' }, t('play.correctWas'), ' ', h('b', null, correctText(q))));
  return h('div', { class: 'result-stack hw-result' }, result, expBox, h('div', { class: 'hw-next' }, nextBtn));
}

async function finish() {
  show(() => msg(h('div', { class: 'spinner' }), t('hw.sending')));
  // Bare første gjennomføring telles hos læreren (ikke «ta den på nytt»).
  let saved = H.submitted;
  if (!saved) {
    try { saved = H.submitted = await backend.submitAssignment(H.code, H.score, H.answers); } catch { /* vises under */ }
  }
  show(() => h('div', { class: 'pmsg final' },
    h('div', { class: 'big-mark' }, exclamationSvg(100)),
    h('div', { class: 'banner' }, t('play.final')),
    H.nScored ? h('p', { class: 'final-place' }, t('hw.result', { n: H.nOk, total: H.nScored })) : null,
    H.nScored ? h('p', null, t('play.finalScore', { n: H.score })) : null,
    h('p', { class: saved ? 'muted small-text' : 'form-error' }, saved ? t('hw.saved') : t('hw.notSaved')),
    h('button', { class: 'btn ghost', onclick: () => { H.i = 0; H.score = 0; H.nOk = 0; H.answers = H.questions.map(() => null); go(0); } }, t('hw.again'))));
}
