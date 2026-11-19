// Spørsmålstyper, poengberegning og import/eksport-format.
import { uid, normText, levenshtein } from './util.js';

export const COLORS = ['#D62839', '#1F5FD1', '#1E8B3A', '#7A3BD9'];
export const SHAPES = [
  '<svg viewBox="0 0 20 20"><polygon points="10,2 19,18 1,18" fill="currentColor"/></svg>',
  '<svg viewBox="0 0 20 20"><polygon points="10,1 19,10 10,19 1,10" fill="currentColor"/></svg>',
  '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8.5" fill="currentColor"/></svg>',
  '<svg viewBox="0 0 20 20"><rect x="2" y="2" width="16" height="16" rx="1.5" fill="currentColor"/></svg>',
];

// Rekkefølgen her er rekkefølgen i «Nytt spørsmål»-menyen.
export const TYPES = ['quiz', 'truefalse', 'short', 'poll', 'wordcloud', 'slider', 'order', 'info'];
export const TYPE_ICONS = { quiz: '▦', truefalse: '◐', short: '✎', poll: '▥', wordcloud: '☁', slider: '⇔', order: '⇅', info: 'ℹ' };
export const TIMES = [5, 10, 20, 30, 45, 60, 90, 120, 240];
export const SCORED = ['quiz', 'truefalse', 'short', 'slider', 'order'];

export function newQuestion(type = 'quiz') {
  const q = { id: uid(8), type, text: '', image: '', time: 20, points: 'standard' };
  switch (type) {
    case 'quiz': q.options = [{ text: '', correct: true }, { text: '', correct: false }, { text: '', correct: false }, { text: '', correct: false }]; break;
    case 'truefalse': q.tf = true; q.time = 10; break;
    case 'short': q.answers = ['']; q.typo = true; q.time = 30; break;
    case 'poll': q.options = [{ text: '' }, { text: '' }, { text: '' }, { text: '' }]; q.points = 'none'; break;
    case 'wordcloud': q.maxWords = 1; q.points = 'none'; q.time = 30; break;
    case 'slider': Object.assign(q, { min: 0, max: 100, step: 1, correct: 50, tolerance: 5, unit: '' }); q.time = 30; break;
    case 'order': q.items = ['', '', '', '']; q.time = 30; break;
    case 'info': q.points = 'none'; q.time = 0; break;
  }
  return q;
}

export function emptyQuiz() {
  return { title: '', description: '', settings: { leaderboard: true, shuffle: false }, questions: [newQuestion('quiz')] };
}

const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Number(v) : d);
const str = v => (v === null || v === undefined ? '' : String(v)).trim();

// Gjør om alt som ligner på en Kwest (eget format eller AI-svar) til riktig format.
export function normalizeQuiz(raw) {
  if (typeof raw === 'string') {
    const s = raw.trim();
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b < a) throw new Error('no-json');
    raw = JSON.parse(s.slice(a, b + 1));
  }
  if (!raw || typeof raw !== 'object') throw new Error('no-json');
  const list = Array.isArray(raw.questions) ? raw.questions : Array.isArray(raw.slides) ? raw.slides : null;
  if (!list) throw new Error('no-questions');
  const quiz = {
    title: str(raw.title) || 'Kwest',
    description: str(raw.description),
    settings: { leaderboard: raw.settings?.leaderboard !== false, shuffle: !!raw.settings?.shuffle },
    questions: list.map(normalizeQuestion).filter(Boolean),
  };
  if (!quiz.questions.length) throw new Error('no-questions');
  return quiz;
}

const TYPE_ALIASES = {
  quiz: 'quiz', multiple: 'quiz', multiplechoice: 'quiz', mc: 'quiz', flervalg: 'quiz',
  truefalse: 'truefalse', tf: 'truefalse', santusant: 'truefalse', boolean: 'truefalse',
  short: 'short', shortanswer: 'short', typeanswer: 'short', text: 'short', kortsvar: 'short',
  poll: 'poll', survey: 'poll', avstemning: 'poll',
  wordcloud: 'wordcloud', ordsky: 'wordcloud', cloud: 'wordcloud',
  slider: 'slider', number: 'slider', glidebryter: 'slider', tall: 'slider',
  order: 'order', puzzle: 'order', ordering: 'order', rekkefolge: 'order', 'rekkefølge': 'order',
  info: 'info', slide: 'info', content: 'info', infoside: 'info',
};

export function normalizeQuestion(r) {
  if (!r || typeof r !== 'object') return null;
  const type = TYPE_ALIASES[str(r.type).toLowerCase().replace(/[\s_\-/]/g, '')] || (r.options ? 'quiz' : 'info');
  const q = newQuestion(type);
  q.text = str(r.text ?? r.question ?? r.title);
  q.image = typeof r.image === 'string' && /^(data:image\/|https:\/\/)/.test(r.image) ? r.image : '';
  if (r.time !== undefined || r.timeLimit !== undefined) q.time = Math.max(0, Math.min(600, Math.round(num(r.time ?? r.timeLimit, q.time))));
  if (['standard', 'double', 'none'].includes(r.points)) q.points = r.points;
  if (type === 'quiz' || type === 'poll') {
    let opts = Array.isArray(r.options) ? r.options : Array.isArray(r.answers) ? r.answers : [];
    opts = opts.slice(0, 4).map((o, i) => {
      const text = typeof o === 'object' && o ? str(o.text ?? o.answer) : str(o);
      let correct = typeof o === 'object' && o ? !!(o.correct ?? o.isCorrect) : false;
      if (r.correct !== undefined) {
        const c = Array.isArray(r.correct) ? r.correct : [r.correct];
        if (c.some(x => x === i || (typeof x === 'string' && normText(x) === normText(text)))) correct = true;
      }
      return type === 'quiz' ? { text, correct } : { text };
    });
    while (opts.length < 2) opts.push(type === 'quiz' ? { text: '', correct: false } : { text: '' });
    q.options = opts;
  }
  if (type === 'truefalse') {
    const c = r.tf ?? r.correct ?? r.answer;
    q.tf = !(c === false || c === 'false' || c === 'usant' || c === 'Usant' || c === 1 || c === 'False');
  }
  if (type === 'short') {
    const a = Array.isArray(r.answers) ? r.answers : r.answer !== undefined ? [r.answer] : r.correct !== undefined ? [].concat(r.correct) : [];
    q.answers = a.map(str).filter(Boolean).slice(0, 10);
    if (!q.answers.length) q.answers = [''];
    q.typo = r.typo !== false;
  }
  if (type === 'wordcloud') q.maxWords = Math.max(1, Math.min(3, Math.round(num(r.maxWords, 1))));
  if (type === 'slider') {
    q.min = num(r.min, 0); q.max = num(r.max, 100);
    if (q.max <= q.min) q.max = q.min + 100;
    q.step = Math.max(0.0001, num(r.step, 1));
    q.correct = Math.min(q.max, Math.max(q.min, num(r.correct ?? r.answer, (q.min + q.max) / 2)));
    q.tolerance = Math.max(0, num(r.tolerance, 0));
    q.unit = str(r.unit);
  }
  if (type === 'order') {
    const it = Array.isArray(r.items) ? r.items : Array.isArray(r.options) ? r.options : [];
    q.items = it.slice(0, 4).map(o => (typeof o === 'object' && o ? str(o.text) : str(o)));
    while (q.items.length < 2) q.items.push('');
  }
  if (type === 'info') { q.time = 0; q.points = 'none'; }
  if (type === 'poll' || type === 'wordcloud') q.points = 'none';
  return q;
}

// Fjerner interne felt før eksport.
export function exportQuiz(quiz) {
  return {
    kwest: 1,
    title: quiz.title,
    description: quiz.description || '',
    settings: quiz.settings,
    questions: quiz.questions.map(({ id, ...rest }) => rest),
  };
}

// Finner feil som gjør at et spørsmål ikke kan spilles. Returnerer [{index, key}].
export function validateQuiz(quiz) {
  const issues = [];
  quiz.questions.forEach((q, i) => {
    const add = key => issues.push({ index: i, key });
    if (!q.text.trim() && !q.image && q.type !== 'info') add('val.noText');
    if (q.type === 'quiz') {
      const filled = q.options.filter(o => o.text.trim());
      if (filled.length < 2) add('val.twoOptions');
      if (!q.options.some(o => o.correct && o.text.trim())) add('val.noCorrect');
    }
    if (q.type === 'poll' && q.options.filter(o => o.text.trim()).length < 2) add('val.twoOptions');
    if (q.type === 'short' && !q.answers.some(a => a.trim())) add('val.noAnswer');
    if (q.type === 'order' && q.items.filter(s => s.trim()).length < 2) add('val.twoItems');
    if (q.type === 'slider' && !(q.max > q.min)) add('val.slider');
  });
  return issues;
}

// Spørsmål klart for spilling (tomme alternativer fjernes).
export function playable(q) {
  const c = { ...q };
  if (c.options) c.options = c.options.filter(o => o.text.trim());
  if (c.items) c.items = c.items.filter(s => s.trim());
  if (c.answers) c.answers = c.answers.filter(s => s.trim());
  return c;
}

export function basePoints(q) {
  return q.points === 'double' ? 2000 : q.points === 'none' ? 0 : 1000;
}

// Kahoot-lignende: riktig svar gir 500–1000 poeng, raskere svar gir mer.
export function speedPoints(q, elapsedMs) {
  const base = basePoints(q);
  if (!base) return 0;
  const limit = Math.max(1, q.time * 1000);
  const frac = Math.min(1, Math.max(0, elapsedMs / limit));
  return Math.round(base * (1 - frac / 2));
}

export function isShortCorrect(q, value) {
  const v = normText(value);
  if (!v) return false;
  return q.answers.some(a => {
    const t = normText(a);
    if (!t) return false;
    if (t === v) return true;
    if (q.typo && t.length >= 5) return levenshtein(t, v) <= (t.length >= 10 ? 2 : 1);
    return false;
  });
}

// value er det spilleren sendte; map er visningsrekkefølgen (vist indeks -> original indeks).
export function judge(q, value, map) {
  switch (q.type) {
    case 'quiz': {
      const i = map ? map[value] : value;
      return !!q.options[i]?.correct;
    }
    case 'truefalse': return (value === 0) === !!q.tf;
    case 'short': return isShortCorrect(q, value);
    case 'slider': return Number.isFinite(Number(value)) && Math.abs(Number(value) - q.correct) <= q.tolerance + 1e-9;
    case 'order': {
      if (!Array.isArray(value) || value.length !== q.items.length) return false;
      return value.every((d, pos) => (map ? map[d] : d) === pos);
    }
    default: return null; // avstemning, ordsky, info: ingen fasit
  }
}

// Sant/usant: «Sant» får blå, «Usant» får rød (samme på storskjerm og mobil).
export function colorIndex(type, i) {
  return type === 'truefalse' ? (i === 0 ? 1 : 0) : i;
}
