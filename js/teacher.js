// Lærersiden: innlogging, oversikt over Kwester, redigering, import/AI og brukeradministrasjon.
import { h, svg, clear, debounce, modal, confirmBox, toast, readImage, download, copyText, fmtDate, baseUrl, uid } from './util.js';
import { t, lang, langButton } from './i18n.js';
import { backend } from './backend.js';
import { COLORS, SHAPES, TYPES, TYPE_ICONS, TIMES, colorIndex, newQuestion, emptyQuiz, normalizeQuiz, exportQuiz, validateQuiz } from './game.js';
import { wordmark, exclamationSvg, questionSvg, setFavicon } from './logo.js';

setFavicon();
const app = document.getElementById('app');
let me = null; // { user, profile }
let recovering = false;

function errMsg(e) { return t('common.error', { msg: e?.message || String(e) }); }

// ---------- Ruting ----------
async function route() {
  if (recovering) return newPasswordView();
  me = await backend.session().catch(() => null);
  if (!me) return authView();
  if (!me.profile?.approved) return pendingView();
  const [, page, id] = (location.hash || '#/').split('/');
  if (page === 'rediger' && id) return editorView(id);
  if (page === 'ny') return editorView(null);
  if (page === 'brukere' && me.profile.is_admin) return usersView();
  if (page === 'alle') return listView('all');
  return listView('mine');
}

window.addEventListener('hashchange', () => { if (!leaveGuard()) route(); });
backend.onAuth(event => {
  if (event === 'PASSWORD_RECOVERY') { recovering = true; route(); }
  if (event === 'SIGNED_OUT') route();
});

function shell(content, active) {
  clear(app);
  const isAdmin = me?.profile?.is_admin;
  const tab = (href, key, name) => h('a', { href, class: 'tab' + (active === key ? ' active' : '') }, name);
  app.append(
    h('header', { class: 'tbar' },
      h('a', { href: '#/', class: 'brand' }, wordmark(34)),
      h('nav', { class: 'tabs' },
        tab('#/', 'mine', t('nav.mine')),
        tab('#/alle', 'all', t('nav.all')),
        isAdmin ? tab('#/brukere', 'users', t('nav.users')) : null),
      h('span', { class: 'spacer' }),
      h('span', { class: 'who' }, me?.profile?.name || me?.user?.email || ''),
      langButton(route),
      h('button', { class: 'btn ghost small', onclick: async () => { await backend.signOut(); route(); } }, t('nav.logout'))),
    h('main', { class: 'tmain' }, content));
}

// ---------- Innlogging ----------
function authView(mode = 'login', notice = '') {
  clear(app);
  const email = h('input', { type: 'email', autocomplete: 'email', required: true, placeholder: t('auth.email'), 'aria-label': t('auth.email') });
  const pw = h('input', { type: 'password', autocomplete: mode === 'login' ? 'current-password' : 'new-password', required: mode !== 'forgot', minlength: mode === 'signup' ? '8' : null, placeholder: t('auth.password'), 'aria-label': t('auth.password') });
  const name = h('input', { type: 'text', autocomplete: 'name', required: true, placeholder: t('auth.name'), 'aria-label': t('auth.name') });
  const msg = h('p', { class: 'form-error', role: 'alert' });
  const info = h('p', { class: 'form-info' }, notice);
  const btn = h('button', { class: 'btn primary wide', type: 'submit' }, mode === 'signup' ? t('auth.signup') : mode === 'forgot' ? t('auth.forgot') : t('auth.login'));
  const submit = async e => {
    e.preventDefault();
    msg.textContent = '';
    btn.disabled = true;
    try {
      if (mode === 'login') { await backend.signIn(email.value.trim(), pw.value); return route(); }
      if (mode === 'forgot') { await backend.resetPassword(email.value.trim()); info.textContent = t('auth.resetSent'); return; }
      if (pw.value.length < 8) { msg.textContent = t('auth.weak'); return; }
      const r = await backend.signUp(email.value.trim(), pw.value, name.value.trim());
      if (r.needsConfirm) return authView('login', t('auth.confirmMail'));
      return route();
    } catch (err) {
      const m = String(err?.message || '');
      msg.textContent = /invalid login/i.test(m) ? t('auth.badLogin') : /already registered|already exists/i.test(m) ? t('auth.exists') : errMsg(err);
    } finally { btn.disabled = false; }
  };
  app.append(h('div', { class: 'auth' },
    h('div', { class: 'auth-top' }, langButton(() => authView(mode, notice))),
    h('div', { class: 'auth-card' },
      h('div', { class: 'auth-logo' }, wordmark(64)),
      h('p', { class: 'auth-intro' }, t('auth.intro')),
      mode !== 'forgot' ? h('div', { class: 'seg' },
        h('button', { class: mode === 'login' ? 'on' : '', type: 'button', onclick: () => authView('login') }, t('auth.login')),
        h('button', { class: mode === 'signup' ? 'on' : '', type: 'button', onclick: () => authView('signup') }, t('auth.signup'))) : null,
      h('form', { class: 'auth-form', onsubmit: submit },
        mode === 'signup' ? name : null, email, mode !== 'forgot' ? pw : null, msg, info, btn),
      mode === 'login' ? h('button', { class: 'link', type: 'button', onclick: () => authView('forgot') }, t('auth.forgot')) : null,
      mode === 'forgot' ? h('button', { class: 'link', type: 'button', onclick: () => authView('login') }, t('auth.login')) : null,
      mode === 'signup' && backend.mode === 'demo' ? h('p', { class: 'muted small-text' }, t('auth.firstAdmin')) : null)));
}

function newPasswordView() {
  clear(app);
  const pw = h('input', { type: 'password', autocomplete: 'new-password', minlength: '8', required: true, placeholder: t('auth.newPassword') });
  const msg = h('p', { class: 'form-error' });
  app.append(h('div', { class: 'auth' }, h('div', { class: 'auth-card' },
    h('div', { class: 'auth-logo' }, wordmark(64)),
    h('form', { class: 'auth-form', onsubmit: async e => {
      e.preventDefault();
      if (pw.value.length < 8) { msg.textContent = t('auth.weak'); return; }
      try { await backend.updatePassword(pw.value); recovering = false; toast(t('auth.passwordSaved'), 'ok'); history.replaceState(null, '', location.pathname); route(); }
      catch (err) { msg.textContent = errMsg(err); }
    } }, pw, msg, h('button', { class: 'btn primary wide', type: 'submit' }, t('auth.savePassword'))))));
}

function pendingView() {
  clear(app);
  app.append(h('div', { class: 'auth' }, h('div', { class: 'auth-card' },
    h('div', { class: 'auth-logo' }, exclamationSvg(80)),
    h('h1', null, t('auth.pending')),
    h('p', null, t('auth.pendingText')),
    h('button', { class: 'btn ghost', onclick: async () => { await backend.signOut(); route(); } }, t('nav.logout')))));
}

// ---------- Oversikt ----------
async function listView(which) {
  shell(h('div', { class: 'spinner' }), which);
  let rows;
  try { rows = await backend.listQuizzes(); }
  catch (e) { return shell(h('p', { class: 'form-error' }, errMsg(e)), which); }
  const mine = rows.filter(r => r.owner === me.user.id);
  const base = which === 'mine' ? mine : rows;
  const search = h('input', { type: 'search', class: 'search', placeholder: t('list.search'), oninput: () => draw() });
  const grid = h('div', { class: 'cards' });
  const draw = () => {
    const s = search.value.trim().toLowerCase();
    const list = base.filter(r => !s || (r.title + ' ' + (r.description || '') + ' ' + (r.owner_name || '')).toLowerCase().includes(s));
    clear(grid);
    if (!list.length) grid.append(h('div', { class: 'empty' }, questionSvg(70), h('p', null, which === 'mine' && !s ? t('list.emptyMine') : t('list.empty'))));
    list.forEach(r => grid.append(card(r, () => listView(which))));
  };
  draw();
  shell(h('div', null,
    h('div', { class: 'list-head' },
      h('h1', null, which === 'mine' ? t('nav.mine') : t('nav.all')),
      h('span', { class: 'spacer' }),
      search,
      h('button', { class: 'btn ghost', onclick: () => importDialog() }, '⇪ ' + t('list.import')),
      h('button', { class: 'btn ghost', onclick: () => aiDialog() }, '✦ ' + t('list.ai')),
      h('a', { class: 'btn primary', href: '#/ny' }, '+ ' + t('list.new'))),
    grid), which);
}

function canEdit(row) { return row.owner === me.user.id || me.profile.is_admin; }

function card(r, refresh) {
  const editable = canEdit(r);
  return h('article', { class: 'card' },
    h('a', { class: 'card-main', href: '#/rediger/' + r.id },
      h('span', { class: 'card-mark' }, questionSvg(34)),
      h('div', null,
        h('h3', null, r.title || t('list.untitled')),
        r.description ? h('p', { class: 'card-desc' }, r.description) : null,
        h('p', { class: 'card-meta' }, t('list.questions', { n: r.question_count ?? '?' }),
          r.owner !== me.user.id && r.owner_name ? ' · ' + t('list.by', { name: r.owner_name }) : '',
          ' · ' + fmtDate(r.updated_at, lang)))),
    h('div', { class: 'card-actions' },
      h('a', { class: 'btn primary small', href: 'host.html?id=' + r.id }, '▶ ' + t('list.play')),
      editable ? h('a', { class: 'btn ghost small', href: '#/rediger/' + r.id }, t('list.edit')) : null,
      h('button', { class: 'btn ghost small', onclick: () => copyQuiz(r) }, t('list.copy')),
      h('button', { class: 'btn ghost small', onclick: () => exportRow(r) }, t('list.export')),
      editable ? h('button', { class: 'btn ghost small danger-text', onclick: async () => {
        if (!(await confirmBox(t('list.delete'), t('list.deleteConfirm', { title: r.title }), t('common.delete'), t('common.cancel')))) return;
        try { await backend.deleteQuiz(r.id); refresh(); } catch (e) { toast(errMsg(e), 'bad'); }
      } }, t('list.delete')) : null));
}

async function copyQuiz(r) {
  try {
    const full = await backend.getQuiz(r.id);
    const saved = await backend.saveQuiz({ title: t('list.copyOf', { title: full.title }), description: full.description, data: full.data });
    toast(t('list.copied'), 'ok');
    location.hash = '#/rediger/' + saved.id;
  } catch (e) { toast(errMsg(e), 'bad'); }
}

async function exportRow(r) {
  try {
    const full = await backend.getQuiz(r.id);
    const data = exportQuiz({ title: full.title, description: full.description, ...full.data });
    download((full.title || 'kwest').replace(/[^\wæøåÆØÅ\- ]+/g, '').trim().replace(/\s+/g, '-') + '.kwest.json', JSON.stringify(data, null, 2));
  } catch (e) { toast(errMsg(e), 'bad'); }
}

// ---------- Import og AI ----------
async function importText(text) {
  const quiz = normalizeQuiz(text);
  const saved = await backend.saveQuiz({ title: quiz.title, description: quiz.description, data: { settings: quiz.settings, questions: quiz.questions } });
  toast(t('imp.done', { n: quiz.questions.length }), 'ok');
  location.hash = '#/rediger/' + saved.id;
}

function importDialog(prefill = '') {
  const ta = h('textarea', { class: 'code-input', rows: '10', placeholder: '{ "title": …, "questions": [ … ] }' });
  ta.value = prefill;
  const msg = h('p', { class: 'form-error' });
  const file = h('input', { type: 'file', accept: '.json,application/json,text/plain', class: 'hidden', onchange: async () => {
    if (file.files[0]) ta.value = await file.files[0].text();
  } });
  let m;
  const go = async () => {
    msg.textContent = '';
    try { await importText(ta.value); m.close(); }
    catch (e) { msg.textContent = /no-json|no-questions|JSON/i.test(String(e?.message)) || e instanceof SyntaxError ? t('imp.bad') : errMsg(e); }
  };
  m = modal(t('imp.title'), h('div', { class: 'stack' }, h('p', null, t('imp.text')), ta, file, msg), [
    h('button', { class: 'btn ghost', onclick: () => file.click() }, t('imp.file')),
    h('button', { class: 'btn primary', onclick: go }, t('imp.go')),
  ]);
  ta.focus();
}

export function aiPrompt(n, extra, language) {
  const no = language !== 'en';
  const lines = no ? [
    'Du skal lage en quiz til undervisningsappen Kwest basert på materialet jeg har lagt ved (PowerPoint, PDF, artikkel e.l.).',
    '',
    'Krav:',
    `- Lag ${n} spørsmål på norsk (bokmål).`,
    '- Spørsmålene skal teste forståelse av det viktigste i materialet, ikke tilfeldige detaljer.',
    '- Bruk mest "quiz" (flervalg), og gjerne noen "truefalse", "short", "slider" og "order" der det passer. Start gjerne med én "wordcloud" eller "poll" som oppvarming.',
    '- Spørsmålstekst: helst under 120 tegn. Svaralternativer: maks 4, helst under 60 tegn hver.',
    '- Gale alternativer skal være troverdige.',
    '- Bruk "points": "double" på 1–2 ekstra viktige spørsmål.',
    extra ? `- Ekstra ønsker: ${extra}` : null,
    '',
    'Svar KUN med gyldig JSON i nøyaktig dette formatet, uten forklaring før eller etter:',
  ] : [
    'Create a quiz for the teaching app Kwest based on the material I have attached (PowerPoint, PDF, article, etc.).',
    '',
    'Requirements:',
    `- Write ${n} questions in English.`,
    '- The questions should test understanding of the most important points, not random details.',
    '- Mostly use "quiz" (multiple choice), plus some "truefalse", "short", "slider" and "order" where suitable. Feel free to start with one "wordcloud" or "poll" as a warm-up.',
    '- Question text: preferably under 120 characters. Answers: max 4, preferably under 60 characters each.',
    '- Wrong answers should be plausible.',
    '- Use "points": "double" on 1–2 especially important questions.',
    extra ? `- Extra wishes: ${extra}` : null,
    '',
    'Reply ONLY with valid JSON in exactly this format, with no explanation before or after:',
  ];
  const example = {
    kwest: 1, title: no ? 'Tittel' : 'Title', description: no ? 'Kort beskrivelse' : 'Short description',
    questions: [
      { type: 'quiz', text: '…', time: 20, points: 'standard', options: [{ text: '…', correct: true }, { text: '…', correct: false }, { text: '…', correct: false }, { text: '…', correct: false }] },
      { type: 'truefalse', text: '…', time: 10, correct: true },
      { type: 'short', text: '…', time: 30, answers: [no ? 'svar' : 'answer', no ? 'annen skrivemåte' : 'alternative spelling'] },
      { type: 'slider', text: '…', time: 30, min: 0, max: 100, step: 1, correct: 42, tolerance: 3, unit: 'mg' },
      { type: 'order', text: '…', time: 30, items: [no ? 'første' : 'first', no ? 'andre' : 'second', no ? 'tredje' : 'third', no ? 'fjerde' : 'fourth'] },
      { type: 'poll', text: '…', time: 20, options: [{ text: '…' }, { text: '…' }] },
      { type: 'wordcloud', text: '…', time: 30, maxWords: 1 },
      { type: 'info', text: '…' },
    ],
  };
  const notes = no ? [
    '',
    'Forklaring: "time" er sekunder (5–240). "order": skriv elementene i RIKTIG rekkefølge (2–4 stk). "slider": "tolerance" er hvor langt unna som regnes som riktig. "short": list alle skrivemåter som skal godtas. "info" er en ren tekstside uten spørsmål.',
  ] : [
    '',
    'Notes: "time" is seconds (5–240). "order": list the items in the CORRECT order (2–4). "slider": "tolerance" is how far off still counts as correct. "short": list every spelling to accept. "info" is a plain text slide without a question.',
  ];
  return [...lines.filter(l => l !== null), JSON.stringify(example, null, 1), ...notes].join('\n');
}

function aiDialog() {
  const count = h('input', { type: 'number', min: '3', max: '40', value: '10', class: 'num-input' });
  const extra = h('input', { type: 'text', placeholder: t('ai.extraPh') });
  const ta = h('textarea', { class: 'code-input', rows: '6', placeholder: t('ai.paste') });
  const msg = h('p', { class: 'form-error' });
  let m;
  m = modal(t('ai.title'), h('div', { class: 'stack' },
    h('p', null, h('b', null, t('ai.step1'))),
    h('div', { class: 'row' }, h('label', { class: 'field' }, h('span', null, t('ai.count')), count), h('label', { class: 'field grow' }, h('span', null, t('ai.extra')), extra)),
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', onclick: async () => { if (await copyText(aiPrompt(Number(count.value) || 10, extra.value.trim(), lang))) toast(t('ai.copied'), 'ok'); } }, t('ai.copy')),
      h('a', { class: 'btn ghost', href: 'https://claude.ai/new', target: '_blank', rel: 'noopener' }, t('ai.open') + ' ↗')),
    h('p', null, h('b', null, t('ai.step2'))),
    h('p', null, h('b', null, t('ai.step3'))),
    ta, msg), [
    h('button', { class: 'btn primary', onclick: async () => {
      msg.textContent = '';
      try { await importText(ta.value); m.close(); } catch { msg.textContent = t('imp.bad'); }
    } }, t('imp.go')),
  ]);
}

// ---------- Redigering ----------
const E = { id: null, owner: null, readonly: false, quiz: null, sel: 0, dirty: false, saving: null, pending: false };

function leaveGuard() {
  // Lagre umiddelbart hvis noe er ulagret når man går bort fra redigeringen.
  if (E.dirty && !E.readonly) saveNow();
  return false;
}
window.addEventListener('beforeunload', e => { if (E.dirty && !E.readonly) { saveNow(); e.preventDefault(); } });

async function editorView(id) {
  shell(h('div', { class: 'spinner' }));
  Object.assign(E, { id, owner: me.user.id, readonly: false, quiz: emptyQuiz(), sel: 0, dirty: false, ownerName: '' });
  if (id) {
    try {
      const row = await backend.getQuiz(id);
      E.owner = row.owner;
      E.readonly = !canEdit(row);
      E.quiz = { title: row.title, description: row.description || '', settings: { leaderboard: true, shuffle: false, ...(row.data?.settings || {}) }, questions: row.data?.questions || [] };
      E.quiz.questions.forEach(q => { q.id ||= uid(8); });
      if (!E.quiz.questions.length) E.quiz.questions.push(newQuestion('quiz'));
      if (E.readonly) {
        const all = await backend.listQuizzes().catch(() => []);
        E.ownerName = all.find(r => r.id === id)?.owner_name || '';
      }
    } catch (e) { return shell(h('p', { class: 'form-error' }, errMsg(e))); }
  }
  drawEditor();
}

const autosave = debounce(() => saveNow(), 1200);
function changed() {
  if (E.readonly) return;
  E.dirty = true;
  setStatus('unsaved');
  autosave();
}

async function saveNow() {
  if (E.readonly || !E.dirty) return;
  if (E.saving) { E.pending = true; return E.saving; }
  E.dirty = false;
  setStatus('saving');
  const q = E.quiz;
  const payload = { id: E.id, title: q.title.trim() || t('list.untitled'), description: q.description.trim(), data: { settings: q.settings, questions: q.questions } };
  E.saving = backend.saveQuiz(payload).then(r => {
    if (!E.id) {
      E.id = r.id;
      history.replaceState(null, '', '#/rediger/' + r.id);
    }
    setStatus(E.dirty ? 'unsaved' : 'saved');
  }).catch(e => {
    E.dirty = true;
    setStatus('unsaved');
    toast(errMsg(e), 'bad');
  }).finally(() => {
    E.saving = null;
    if (E.pending) { E.pending = false; saveNow(); }
  });
  return E.saving;
}

function setStatus(s) {
  const el = document.querySelector('.save-status');
  if (!el) return;
  el.dataset.s = s;
  el.textContent = s === 'saving' ? t('ed.saving') : s === 'saved' ? '✓ ' + t('ed.saved') : t('ed.unsaved');
}

function drawEditor() {
  const q = E.quiz;
  const title = h('input', { class: 'title-input', value: q.title, placeholder: t('ed.title'), disabled: E.readonly, oninput: e => { q.title = e.target.value; changed(); } });
  const startBtn = h('button', { class: 'btn primary', onclick: startGame }, t('ed.play'));
  shell(h('div', { class: 'editor' + (E.readonly ? ' readonly' : '') },
    h('div', { class: 'ed-head' },
      h('a', { class: 'btn ghost small', href: '#/' }, t('ed.back')),
      title,
      h('span', { class: 'save-status', 'data-s': 'saved' }, E.id ? '✓ ' + t('ed.saved') : ''),
      h('button', { class: 'btn ghost', onclick: settingsDialog, disabled: E.readonly }, '⚙ ' + t('ed.settings')),
      E.readonly ? h('button', { class: 'btn ghost', onclick: () => copyQuiz({ id: E.id }) }, t('list.copy')) : null,
      startBtn),
    E.readonly ? h('p', { class: 'notice' }, t('ed.readonly', { name: E.ownerName || '?' })) : null,
    h('div', { class: 'ed-body' },
      h('aside', { class: 'ed-side' }, h('ol', { class: 'qlist' }), E.readonly ? null : addButton()),
      h('section', { class: 'ed-panel' }))));
  drawList();
  drawPanel();
  if (!E.id && !E.readonly) setTimeout(() => title.focus(), 50);
}

function addButton() {
  return h('button', { class: 'btn add-btn', onclick: typePicker }, t('ed.addQuestion'));
}

function typePicker() {
  let m;
  m = modal(t('ed.addQuestion').replace('+', '').trim(), h('div', { class: 'type-grid' }, TYPES.map(type => h('button', { class: 'type-item', onclick: () => {
    m.close();
    E.quiz.questions.splice(E.sel + 1, 0, newQuestion(type));
    E.sel++;
    changed(); drawList(); drawPanel();
  } }, h('span', { class: 'type-icon' }, TYPE_ICONS[type]), h('span', null, h('b', null, t('type.' + type)), h('small', null, t('typeDesc.' + type)))))));
}

function drawList() {
  const list = document.querySelector('.qlist');
  if (!list) return;
  clear(list);
  const issues = validateQuiz(E.quiz);
  E.quiz.questions.forEach((q, i) => {
    const bad = issues.some(x => x.index === i);
    list.append(h('li', { class: 'qitem' + (i === E.sel ? ' sel' : '') + (bad ? ' bad' : ''), onclick: () => { E.sel = i; drawList(); drawPanel(); } },
      h('span', { class: 'qitem-n' }, i + 1),
      h('div', { class: 'qitem-body' },
        h('span', { class: 'qitem-type' }, TYPE_ICONS[q.type] + ' ' + t('type.' + q.type)),
        h('span', { class: 'qitem-text' }, q.text || '…')),
      q.image ? h('img', { class: 'qitem-img', src: q.image, alt: '' }) : null));
  });
}

function refreshItem() {
  const el = document.querySelectorAll('.qitem')[E.sel];
  const q = E.quiz.questions[E.sel];
  if (el) el.querySelector('.qitem-text').textContent = q.text || '…';
}

function select(options, value, onChange, disabled) {
  return h('select', { disabled, onchange: e => onChange(e.target.value) }, options.map(([v, label]) => h('option', { value: v, selected: String(v) === String(value) }, label)));
}

function drawPanel() {
  const panel = document.querySelector('.ed-panel');
  if (!panel) return;
  clear(panel);
  const q = E.quiz.questions[E.sel];
  if (!q) return;
  const ro = E.readonly;
  const rerender = () => { changed(); drawList(); drawPanel(); };

  const changeType = type => {
    const fresh = newQuestion(type);
    fresh.id = q.id; fresh.text = q.text; fresh.image = q.image;
    if (type !== 'info' && q.type !== 'info' && q.time) fresh.time = q.time;
    // Ta med svaralternativene der det gir mening.
    const texts = q.options ? q.options.map(o => o.text) : q.items ? q.items : null;
    if (texts && fresh.options) fresh.options = texts.map((text, i) => (type === 'quiz' ? { text, correct: q.options ? !!q.options[i]?.correct : i === 0 } : { text }));
    if (texts && fresh.items) fresh.items = texts.slice();
    E.quiz.questions[E.sel] = fresh;
    rerender();
  };

  const tools = h('div', { class: 'panel-tools' },
    h('label', { class: 'field' }, h('span', null, t('ed.type')), select(TYPES.map(x => [x, TYPE_ICONS[x] + ' ' + t('type.' + x)]), q.type, changeType, ro)),
    q.type !== 'info' ? h('label', { class: 'field' }, h('span', null, t('ed.time')), select(TIMES.map(s => [s, t('ed.seconds', { n: s })]), q.time, v => { q.time = Number(v); changed(); }, ro)) : null,
    ['quiz', 'truefalse', 'short', 'slider', 'order'].includes(q.type) ? h('label', { class: 'field' }, h('span', null, t('ed.points')),
      select([['standard', t('ed.pStandard')], ['double', t('ed.pDouble')], ['none', t('ed.pNone')]], q.points, v => { q.points = v; changed(); }, ro)) : null,
    h('span', { class: 'spacer' }),
    ro ? null : h('div', { class: 'qtools' },
      h('button', { class: 'icon-btn', title: t('ed.moveUp'), disabled: E.sel === 0, onclick: () => move(-1) }, '↑'),
      h('button', { class: 'icon-btn', title: t('ed.moveDown'), disabled: E.sel === E.quiz.questions.length - 1, onclick: () => move(1) }, '↓'),
      h('button', { class: 'icon-btn', title: t('ed.duplicate'), onclick: () => {
        const copy = JSON.parse(JSON.stringify(q)); copy.id = uid(8);
        E.quiz.questions.splice(E.sel + 1, 0, copy); E.sel++; rerender();
      } }, '⧉'),
      h('button', { class: 'icon-btn danger-text', title: t('ed.deleteQ'), disabled: E.quiz.questions.length === 1, onclick: () => {
        E.quiz.questions.splice(E.sel, 1); E.sel = Math.max(0, E.sel - 1); rerender();
      } }, '🗑')));

  const text = h('textarea', { class: 'q-text', rows: '2', maxlength: '400', placeholder: q.type === 'info' ? t('ed.infoPh') : t('ed.questionPh'), disabled: ro,
    oninput: e => { q.text = e.target.value; changed(); refreshItem(); } });
  text.value = q.text;

  panel.append(tools,
    h('div', { class: 'q-slide' },
      h('div', { class: 'q-slide-head' }, h('span', { class: 'q-mark' }, q.type === 'info' ? exclamationSvg(40) : questionSvg(40)), text),
      imageBox(q, ro),
      typeEditor(q, ro, rerender)));

  const issues = validateQuiz(E.quiz).filter(x => x.index === E.sel);
  if (issues.length) panel.append(h('p', { class: 'q-issues' }, '⚠ ' + issues.map(x => t(x.key)).join(', ')));
}

function move(d) {
  const qs = E.quiz.questions;
  const j = E.sel + d;
  [qs[E.sel], qs[j]] = [qs[j], qs[E.sel]];
  E.sel = j;
  changed(); drawList(); drawPanel();
}

function imageBox(q, ro) {
  const input = h('input', { type: 'file', accept: 'image/*', class: 'hidden', onchange: () => input.files[0] && setImage(q, input.files[0]) });
  if (q.image) {
    return h('div', { class: 'img-box has' },
      h('img', { src: q.image, alt: '' }),
      ro ? null : h('button', { class: 'btn ghost small img-remove', onclick: () => { q.image = ''; changed(); drawList(); drawPanel(); } }, t('ed.removeImage')));
  }
  if (ro) return null;
  const box = h('div', { class: 'img-box', tabindex: '0', role: 'button', onclick: () => input.click(),
    onkeydown: e => { if (e.key === 'Enter') input.click(); },
    ondragover: e => { e.preventDefault(); box.classList.add('drag'); },
    ondragleave: () => box.classList.remove('drag'),
    ondrop: e => { e.preventDefault(); box.classList.remove('drag'); const f = e.dataTransfer.files[0]; if (f) setImage(q, f); },
  }, h('span', { class: 'img-plus' }, '🖼'), h('span', null, t('ed.imageHint')), input);
  return box;
}

async function setImage(q, file) {
  try {
    const url = await readImage(file);
    if (url.length > 1_500_000) return toast(t('ed.tooBig'), 'bad');
    q.image = url;
    changed(); drawList(); drawPanel();
  } catch (e) { toast(errMsg(e), 'bad'); }
}

// Lim inn bilde fra utklippstavlen i redigeringen.
document.addEventListener('paste', e => {
  if (!document.querySelector('.ed-panel') || E.readonly) return;
  const file = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/'));
  if (file) { e.preventDefault(); setImage(E.quiz.questions[E.sel], file); }
});

function optionTile(i, type, content, extra) {
  const ci = colorIndex(type, i);
  return h('div', { class: 'opt', style: { '--c': COLORS[ci] } }, h('span', { class: 'opt-shape' }, svg(SHAPES[ci])), content, extra);
}

function typeEditor(q, ro, rerender) {
  switch (q.type) {
    case 'quiz':
    case 'poll': {
      const grid = h('div', { class: 'opts' }, q.options.map((o, i) => {
        const inp = h('input', { class: 'opt-input', value: o.text, maxlength: '120', disabled: ro, placeholder: i < 2 ? t('ed.option', { n: i + 1 }) : t('ed.optionOpt', { n: i + 1 }),
          oninput: e => { o.text = e.target.value; changed(); } });
        const mark = q.type === 'quiz' ? h('button', { class: 'opt-correct' + (o.correct ? ' on' : ''), title: t('ed.markCorrect'), 'aria-pressed': String(!!o.correct), disabled: ro,
          onclick: () => { o.correct = !o.correct; rerender(); } }, '✓') : null;
        const del = !ro && q.options.length > 2 ? h('button', { class: 'opt-del', title: t('common.delete'), onclick: () => { q.options.splice(i, 1); rerender(); } }, '✕') : null;
        return optionTile(i, q.type, inp, [mark, del]);
      }));
      return h('div', null, grid, !ro && q.options.length < 4 ? h('button', { class: 'btn ghost small', onclick: () => { q.options.push(q.type === 'quiz' ? { text: '', correct: false } : { text: '' }); rerender(); } }, '+ ' + t('ed.option', { n: q.options.length + 1 })) : null);
    }
    case 'truefalse':
      return h('div', null, h('p', { class: 'muted' }, t('ed.correctIs')), h('div', { class: 'opts' },
        [true, false].map((v, i) => optionTile(i, 'truefalse', h('span', { class: 'opt-label' }, v ? t('ed.true') : t('ed.false')),
          h('button', { class: 'opt-correct' + (q.tf === v ? ' on' : ''), disabled: ro, title: t('ed.markCorrect'), onclick: () => { q.tf = v; rerender(); } }, '✓')))));
    case 'short': {
      const ta = h('textarea', { rows: '4', disabled: ro, placeholder: '…', oninput: e => { q.answers = e.target.value.split('\n').map(s => s.trim()).filter((s, i, a) => s || i === 0 || a.length === 1); changed(); } });
      ta.value = q.answers.join('\n');
      return h('div', { class: 'stack' },
        h('label', { class: 'field' }, h('span', null, t('ed.answers')), ta),
        h('p', { class: 'muted small-text' }, t('ed.answersHint')),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: q.typo, disabled: ro, onchange: e => { q.typo = e.target.checked; changed(); } }), t('ed.typo')));
    }
    case 'wordcloud':
      return h('label', { class: 'field' }, h('span', null, t('ed.maxWords')),
        select([[1, '1'], [2, '2'], [3, '3']], q.maxWords, v => { q.maxWords = Number(v); changed(); }, ro));
    case 'slider': {
      const numField = (key, label) => h('label', { class: 'field' }, h('span', null, label),
        h('input', { type: key === 'unit' ? 'text' : 'number', class: 'num-input', value: q[key], disabled: ro, step: 'any',
          oninput: e => { q[key] = key === 'unit' ? e.target.value : Number(e.target.value); changed(); } }));
      return h('div', { class: 'row wrap' }, numField('min', t('ed.min')), numField('max', t('ed.max')), numField('step', t('ed.step')),
        numField('correct', t('ed.correct')), numField('tolerance', t('ed.tolerance')), numField('unit', t('ed.unit')));
    }
    case 'order':
      return h('div', null, h('p', { class: 'muted' }, t('ed.items')),
        h('div', { class: 'opts list' }, q.items.map((it, i) => optionTile(i, 'order',
          h('input', { class: 'opt-input', value: it, maxlength: '120', disabled: ro, placeholder: t('ed.item', { n: i + 1 }), oninput: e => { q.items[i] = e.target.value; changed(); } }),
          [h('span', { class: 'opt-num' }, i + 1), !ro && q.items.length > 2 ? h('button', { class: 'opt-del', onclick: () => { q.items.splice(i, 1); rerender(); } }, '✕') : null]))),
        !ro && q.items.length < 4 ? h('button', { class: 'btn ghost small', onclick: () => { q.items.push(''); rerender(); } }, '+ ' + t('ed.item', { n: q.items.length + 1 })) : null);
    default:
      return null;
  }
}

function settingsDialog() {
  const q = E.quiz;
  const desc = h('textarea', { rows: '2', placeholder: t('ed.description') });
  desc.value = q.description;
  modal(t('ed.settings'), h('div', { class: 'stack' },
    h('label', { class: 'field' }, h('span', null, t('ed.description')), desc),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: q.settings.leaderboard, onchange: e => { q.settings.leaderboard = e.target.checked; changed(); } }), t('ed.leaderboard')),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: q.settings.shuffle, onchange: e => { q.settings.shuffle = e.target.checked; changed(); } }), t('ed.shuffle'))));
  desc.addEventListener('input', () => { q.description = desc.value; changed(); });
}

async function startGame() {
  const issues = validateQuiz(E.quiz);
  if (issues.length) {
    modal(t('ed.issues'), h('ul', { class: 'issue-list' }, issues.map(x => h('li', null, h('button', { class: 'link', onclick: () => {
      document.querySelector('.modal-wrap')?.remove();
      E.sel = x.index; drawList(); drawPanel();
    } }, t('ed.qn', { n: x.index + 1 })), ' ' + t(x.key)))));
    return;
  }
  if (!E.readonly) { E.dirty = E.dirty || !E.id; await saveNow(); }
  if (E.id) location.href = 'host.html?id=' + E.id;
}

// ---------- Brukere (bare administrator) ----------
async function usersView() {
  shell(h('div', { class: 'spinner' }), 'users');
  let users;
  try { users = await backend.listProfiles(); } catch (e) { return shell(h('p', { class: 'form-error' }, errMsg(e)), 'users'); }
  const link = baseUrl() + 'laerer.html';
  const toggle = (u, key) => h('input', { type: 'checkbox', checked: u[key], disabled: u.id === me.user.id, 'aria-label': t('users.' + (key === 'approved' ? 'approved' : 'admin')),
    onchange: async e => {
      try { await backend.updateProfile(u.id, { [key]: e.target.checked }); u[key] = e.target.checked; toast('✓', 'ok'); }
      catch (err) { e.target.checked = !e.target.checked; toast(errMsg(err), 'bad'); }
    } });
  shell(h('div', null,
    h('h1', null, t('users.title')),
    h('div', { class: 'invite' }, h('p', null, t('users.invite')),
      h('div', { class: 'row' }, h('code', { class: 'invite-link' }, link),
        h('button', { class: 'btn ghost small', onclick: async () => { if (await copyText(link)) toast(t('users.linkCopied'), 'ok'); } }, t('users.copyLink')))),
    h('table', { class: 'users' },
      h('thead', null, h('tr', null, h('th', null, t('auth.name')), h('th', null, t('auth.email')), h('th', null, t('users.joined')), h('th', null, t('users.approved')), h('th', null, t('users.admin')))),
      h('tbody', null, users.map(u => h('tr', { class: u.approved ? '' : 'pending' },
        h('td', null, u.name || '–', u.id === me.user.id ? ' ' + t('users.you') : '', !u.approved ? h('span', { class: 'badge' }, t('users.pending')) : null),
        h('td', null, u.email),
        h('td', null, fmtDate(u.created_at, lang)),
        h('td', null, toggle(u, 'approved')),
        h('td', null, toggle(u, 'is_admin'))))))), 'users');
}

if (backend.mode === 'demo') { document.body.classList.add('is-demo'); document.body.append(h('div', { class: 'demo-banner' }, t('demo.banner'))); }
// Supabase sender brukeren hit med #access_token… etter «glemt passord»; vent på hendelsen.
if (/type=recovery/.test(location.hash)) recovering = true;
route();
