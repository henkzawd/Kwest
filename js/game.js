// Spørsmålstyper, poengberegning og import/eksport-format.
import { uid, normText, levenshtein } from './util.js';

// Svarfargene og symbolene. Temaet «Fjell» (standard): solnedgang, fjord, lyng og skifer med sol, bølge, lyng og måne.
// Temaet «Metropolis» bytter til sjøgrønn, himmelblå, kull og offwhite med mynter, kort, sparegris og vekstgraf.
// Listene under endres på stedet av applyTheme(), så alle som har importert dem får riktig tema.
export const COLORS = ['#D0571F', '#12808C', '#A23A72', '#3E4C63'];
export const COLOR_FG = ['#fff', '#fff', '#fff', '#fff']; // farge på symbolet inni sirkelen
export const COLOR_EDGE = [...COLORS]; // kantfarge (offwhite trenger en mørkere kant for å synes)
export const SHAPES = [
  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.6" fill="currentColor"/><path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.4 5.4l1.8 1.8M16.8 16.8l1.8 1.8M5.4 18.6l1.8-1.8M16.8 7.2l1.8-1.8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>',
  '<svg viewBox="0 0 24 24"><path d="M2.5 9.2c2.4-2.6 4.8-2.6 7.2 0s4.8 2.6 7.2 0c1.6-1.7 3.2-2.3 4.6-1.6M2.5 15.6c2.4-2.6 4.8-2.6 7.2 0s4.8 2.6 7.2 0c1.6-1.7 3.2-2.3 4.6-1.6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" fill="none"/></svg>',
  '<svg viewBox="0 0 24 24"><g fill="currentColor"><circle cx="12" cy="6.4" r="3.3"/><circle cx="17.3" cy="10.3" r="3.3"/><circle cx="15.3" cy="16.5" r="3.3"/><circle cx="8.7" cy="16.5" r="3.3"/><circle cx="6.7" cy="10.3" r="3.3"/></g></svg>',
  '<svg viewBox="0 0 24 24"><path d="M15.2 2.8a9.4 9.4 0 1 0 6 14.4 7.6 7.6 0 0 1-6-14.4z" fill="currentColor"/></svg>',
];
// Farger i ordskyen.
export const CLOUD_COLORS = ['#2A1D05', ...COLORS, '#A8740F'];

// Rekkefølgen her er rekkefølgen i «Nytt spørsmål»-menyen.
export const TYPES = ['quiz', 'truefalse', 'short', 'poll', 'wordcloud', 'slider', 'order', 'info', 'scoreboard'];
export const TYPE_ICONS = { quiz: '▦', truefalse: '◐', short: '✎', poll: '▥', wordcloud: '☁', slider: '⇔', order: '⇅', info: 'ℹ', scoreboard: '⛰' };
export const TIMES = [5, 10, 20, 30, 45, 60, 90, 120, 240];
export const SCORED = ['quiz', 'truefalse', 'short', 'slider', 'order'];
// Spørsmål som kan ha «diskuter med sidemannen og stem igjen».
export const DISCUSS_TYPES = ['quiz', 'truefalse', 'poll'];
// Lag: farger og antall (navnene står i i18n.js som team.0 … team.7).
export const TEAM_COLORS = ['#D0571F', '#12808C', '#A23A72', '#3E4C63', '#A8740F', '#4E7A3B', '#7A4A2E', '#6D6A5C'];
// Reaksjoner elevene kan sende til storskjermen (bare disse – ingen fritekst). Bokstaven er nøkkelen i meldingen.
export const REACTIONS = { g: '🐐', p: '⛰️' };

// ---------- Tema for storskjermen ----------
// «mountain» (Fjell, standard) eller «city» (Metropolis: Barcode i Oslo en vinterkveld).
export const THEMES = ['mountain', 'city'];
export function themeOf(settings) { return settings?.theme === 'city' ? 'city' : 'mountain'; }
const STROKE = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const THEME_DATA = {
  mountain: {
    colors: [...COLORS], fg: [...COLOR_FG], edge: [...COLORS], shapes: [...SHAPES], cloud: [...CLOUD_COLORS], reactions: { ...REACTIONS },
  },
  city: {
    colors: ['#007272', '#7DB7F0', '#2B3236', '#F4F1EA'],
    fg: ['#fff', '#0E2233', '#fff', '#2B3236'],
    edge: ['#007272', '#3F86CF', '#2B3236', '#8C8576'],
    shapes: [
      STROKE('<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v4c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 10v4c0 1.7 3.1 3 7 3s7-1.3 7-3v-4"/><path d="M5 14v4c0 1.7 3.1 3 7 3s7-1.3 7-3v-4"/>'),
      STROKE('<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 9.5h19"/><path d="M6 15h4"/>'),
      STROKE('<path d="M4 11c0-3.3 3.6-6 8-6 1.4 0 2.7.3 3.8.8L19 4.5v3.3c1 .9 1.7 2 1.9 3.2H22v3h-1.4c-.5 1.2-1.4 2.3-2.6 3V20h-3v-1.4a10 10 0 0 1-4 0V20H8v-2.3C5.6 16.5 4 14 4 11z"/><path d="M10 7.8h3.4"/><circle cx="16.4" cy="10.2" r=".6" fill="currentColor"/>'),
      STROKE('<path d="M3 20h18"/><path d="M5 16l5-5 3 3 6-7"/><path d="M15 7h4v4"/>'),
    ],
    cloud: ['#0F2A2D', '#007272', '#1F5FA8', '#2B3236', '#8A5A00', '#14555A'],
    // Verdiene i «The Guide»: Start med kunden, Gjør det rette, Få det gjort, Ett lag.
    reactions: { k: '🙋', r: '🫶', d: '✅', l: '🤜🤛' },
  },
};
export let THEME = 'mountain';
const fill = (arr, src) => { arr.length = 0; arr.push(...src); };
export function applyTheme(name) {
  THEME = THEMES.includes(name) ? name : 'mountain';
  const d = THEME_DATA[THEME];
  fill(COLORS, d.colors); fill(COLOR_FG, d.fg); fill(COLOR_EDGE, d.edge); fill(SHAPES, d.shapes); fill(CLOUD_COLORS, d.cloud);
  for (const k of Object.keys(REACTIONS)) delete REACTIONS[k];
  Object.assign(REACTIONS, d.reactions);
  if (typeof document !== 'undefined') document.body?.classList.toggle('theme-city', THEME === 'city');
  return THEME;
}
// CSS-variablene til et svaralternativ: fyllfarge, symbolfarge og kantfarge.
export function answerStyle(ci) {
  return { '--c': COLORS[ci], '--cf': COLOR_FG[ci], '--ce': COLOR_EDGE[ci] };
}
// Poeng vises som høydemeter i Fjell og som etasjer i Metropolis (10 poeng = én etasje, så et fullt riktig svar gir opptil ti etasjer).
export function units(points) {
  return THEME === 'city' ? Math.round((Number(points) || 0) / 10) : points;
}

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
  const q = { id: uid(8), type, text: '', image: '', audio: '', autoplay: true, explanation: '', explanationImage: '', time: 20, points: 'standard' };
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

// Lesetid: sekunder spørsmålet vises på storskjermen før elevene kan svare.
export const READ_TIMES = [3, 6, 10, 15, 20];
export const DEFAULT_READ_TIME = 6;
export function readTime(settings) {
  const n = Number(settings?.readTime);
  return Number.isFinite(n) && n >= 1 && n <= 60 ? Math.round(n) : DEFAULT_READ_TIME;
}

// Lydspor: musikken på storskjermen. Nye lydspor legges også inn i js/music.js; «none» = bare lydeffekter.
export const SOUNDTRACKS = ['whiteTiger', 'jotunheimen', 'none'];
export const DEFAULT_SOUNDTRACK = 'whiteTiger';
export function soundtrack(settings) {
  return SOUNDTRACKS.includes(settings?.soundtrack) ? settings.soundtrack : DEFAULT_SOUNDTRACK;
}

export function emptyQuiz() {
  return { title: '', description: '', settings: { leaderboard: true, shuffle: false, finale: false, readTime: DEFAULT_READ_TIME, soundtrack: DEFAULT_SOUNDTRACK, theme: 'mountain' }, questions: [newQuestion('quiz')] };
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
    settings: { leaderboard: raw.settings?.leaderboard !== false, shuffle: !!raw.settings?.shuffle, finale: !!raw.settings?.finale, anonymous: !!raw.settings?.anonymous, readTime: readTime(raw.settings), soundtrack: soundtrack(raw.settings), theme: themeOf(raw.settings) },
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
  const expImg = r.explanationImage ?? r.explanation_image;
  q.explanationImage = typeof expImg === 'string' && /^(data:image\/|https:\/\/)/.test(expImg) ? expImg : '';
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

// Poengene er høydemeter: et riktig svar gir 50–100 m (raskere svar gir mer), dobbel gir 100–200 m.
export function basePoints(q) {
  return q.points === 'double' ? 200 : q.points === 'none' ? 0 : 100;
}

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

// Sant/usant: «Sant» får sola, «Usant» får månen (samme på storskjerm og mobil).
export function colorIndex(type, i) {
  return type === 'truefalse' ? (i === 0 ? 0 : 3) : i;
}
