// Spørsmålstyper, poengberegning og import/eksport-format.
import { uid, normText, levenshtein } from './util.js';

export const COLORS = ['#D62839', '#1F5FD1', '#1E8B3A', '#7A3BD9'];
// Eventyr-symboler: fjell, kompass, ryggsekk og veiskilt.
export const SHAPES = [
  '<svg viewBox="0 0 20 20"><path fill="currentColor" d="M.6 17.6 7.2 5.4l3.3 6 2.6-3.9 6.3 10.1z"/><path fill="#fff" opacity=".55" d="M7.2 5.4 9.1 8.9 7.9 8.3 6.8 9.5 5.6 8.3z"/></svg>',
  '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8.2" fill="none" stroke="currentColor" stroke-width="2.2"/><path fill="currentColor" d="M14.8 5.2 11.3 11.3 5.2 14.8 8.7 8.7z"/><circle cx="10" cy="10" r="1.3" fill="#fff" opacity=".6"/></svg>',
  '<svg viewBox="0 0 20 20"><path fill="currentColor" d="M7.2 5V4a2.8 2.8 0 0 1 5.6 0v1h-1.7V4a1.1 1.1 0 0 0-2.2 0v1z"/><path fill="currentColor" fill-rule="evenodd" d="M7 5h6a4 4 0 0 1 4 4v7.2a2.3 2.3 0 0 1-2.3 2.3H5.3A2.3 2.3 0 0 1 3 16.2V9a4 4 0 0 1 4-4zm-.5 7.2a1 1 0 0 0-1 1v2.6a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-2.6a1 1 0 0 0-1-1z"/></svg>',
  '<svg viewBox="0 0 20 20"><rect x="9" y="1.5" width="2.2" height="17.5" rx=".8" fill="currentColor"/><path fill="currentColor" d="M2.5 3.6h10.6l3 2.4-3 2.4H2.5z"/><path fill="currentColor" d="M17.6 10.2H7l-3 2.4 3 2.4h10.6z"/></svg>',
];

// Rekkefølgen her er rekkefølgen i «Nytt spørsmål»-menyen.
export const TYPES = ['quiz', 'truefalse', 'short', 'poll', 'wordcloud', 'slider', 'order', 'info', 'scoreboard'];
export const TYPE_ICONS = { quiz: '▦', truefalse: '◐', short: '✎', poll: '▥', wordcloud: '☁', slider: '⇔', order: '⇅', info: 'ℹ', scoreboard: '⛰' };
export const TIMES = [5, 10, 20, 30, 45, 60, 90, 120, 240];
export const SCORED = ['quiz', 'truefalse', 'short', 'slider', 'order'];
// Spørsmål som kan ha «diskuter med sidemannen og stem igjen».
export const DISCUSS_TYPES = ['quiz', 'truefalse', 'poll'];
// Lag: farger og antall (navnene står i i18n.js som team.0 … team.7).
export const TEAM_COLORS = ['#D62839', '#1F5FD1', '#1E8B3A', '#7A3BD9', '#E07B10', '#0E8C8C', '#C2185B', '#5D4037'];
// Reaksjoner elevene kan sende til storskjermen (bare disse – ingen fritekst).
export const REACTIONS = { g: '🐐', p: '⛰️' };

// Finalen: det siste spørsmålet som gir poeng teller dobbelt når læreren har slått det på.
export function finaleIndex(quiz) {
  if (!quiz?.settings?.finale) return -1;
  for (let i = quiz.questions.length - 1; i >= 0; i--) {
    const q = quiz.questions[i];
    if (SCORED.includes(q.type) && q.points !== 'none') return i;
  }
  return -1;
}

export function newQuestion(type = 'quiz') {
  const q = { id: uid(8), type, text: '', image: '', audio: '', autoplay: true, explanation: '', time: 20, points: 'standard' };
  switch (type) {
    case 'quiz': q.options = [{ text: '', correct: true }, { text: '', correct: false }, { text: '', correct: false }, { text: '', correct: false }]; break;
    case 'truefalse': q.tf = true; q.time = 10; break;
    case 'short': q.answers = ['']; q.typo = true; q.time = 30; break;
    case 'poll': q.options = [{ text: '' }, { text: '' }, { text: '' }, { text: '' }]; q.points = 'none'; break;
    case 'wordcloud': q.maxWords = 1; q.points = 'none'; q.time = 30; break;
    case 'slider': Object.assign(q, { min: 0, max: 100, step: 1, correct: 50, tolerance: 5, unit: '' }); q.time = 30; break;
    case 'order': q.items = ['', '', '', '']; q.time = 30; break;
    case 'info': q.points = 'none'; q.time = 0; break;
    case 'scoreboard': q.points = 'none'; q.time = 0; break;
  }
  return q;
}

export function emptyQuiz() {
  return { title: '', description: '', settings: { leaderboard: true, shuffle: false, finale: false }, questions: [newQuestion('quiz')] };
}

const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Number(v) : d);
const str = v => (v === null || v === undefined ? '' : String(v)).trim();

// Gjør om alt som ligner på et kwest (eget format eller AI-svar) til riktig format.
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
    settings: { leaderboard: raw.settings?.leaderboard !== false, shuffle: !!raw.settings?.shuffle, finale: !!raw.settings?.finale },
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
  scoreboard: 'scoreboard', leaderboard: 'scoreboard', poengtavle: 'scoreboard',
};

// AI-en legger av og til forklaringen under et annet navn eller inne i svaralternativene. Finn den uansett.
const EXP_KEYS = ['explanation', 'forklaring', 'explain', 'rationale', 'begrunnelse', 'feedback', 'tilbakemelding', 'solution', 'losning', 'løsning', 'comment', 'kommentar', 'note', 'notes'];
function pickExp(o) {
  if (!o || typeof o !== 'object') return '';
  for (const k of Object.keys(o)) {
    if (EXP_KEYS.includes(k.toLowerCase().replace(/[\s_-]/g, ''))) {
      const v = o[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
      if (v && typeof v === 'object' && typeof (v.text ?? v.no ?? v.nb) === 'string') return String(v.text ?? v.no ?? v.nb).trim();
    }
  }
  return '';
}
function findExplanation(r) {
  const direct = pickExp(r);
  if (direct) return direct;
  // Inne i svaralternativene: bruk forklaringen på det riktige alternativet, ellers den første som finnes.
  const lists = [r.options, r.answers, r.items].filter(Array.isArray);
  for (const list of lists) {
    const right = list.find(o => o && typeof o === 'object' && (o.correct || o.isCorrect) && pickExp(o));
    if (right) return pickExp(right);
  }
  for (const list of lists) {
    const any = list.find(o => pickExp(o));
    if (any) return pickExp(any);
  }
  if (r.answer && typeof r.answer === 'object') return pickExp(r.answer);
  return '';
}

export function normalizeQuestion(r) {
  if (!r || typeof r !== 'object') return null;
  const type = TYPE_ALIASES[str(r.type).toLowerCase().replace(/[\s_\-/]/g, '')] || (r.options ? 'quiz' : 'info');
  const q = newQuestion(type);
  q.text = str(r.text ?? r.question ?? r.title);
  q.image = typeof r.image === 'string' && /^(data:image\/|https:\/\/)/.test(r.image) ? r.image : '';
  q.audio = typeof r.audio === 'string' && /^(data:audio\/|https:\/\/)/.test(r.audio) ? r.audio : '';
  q.autoplay = r.autoplay !== false;
  q.explanation = findExplanation(r)
    .replace(/^\s*(forklaring|explanation)\s*:\s*/i, '')
    .replace(/^1[–-]3 (setninger|sentences) .*$/i, '') // eksempelteksten kopiert uendret
    .trim().slice(0, 600);
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
  if (r.discuss && DISCUSS_TYPES.includes(type)) q.discuss = true;
  if (type === 'info' || type === 'scoreboard') { q.time = 0; q.points = 'none'; }
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
    if (!q.text.trim() && !q.image && !q.audio && q.type !== 'info' && q.type !== 'scoreboard') add('val.noText');
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
