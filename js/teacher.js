// Lærersiden: innlogging, oversikt over kwest, redigering, import/AI og brukeradministrasjon.
import { h, svg, clear, debounce, modal, confirmBox, toast, readImage, download, copyText, fmtDate, baseUrl, uid } from './util.js';
import { t, lang, langButton } from './i18n.js';
import { backend } from './backend.js';
import { COLORS, SHAPES, TYPES, TYPE_ICONS, TIMES, colorIndex, newQuestion, emptyQuiz, normalizeQuiz, exportQuiz, validateQuiz } from './game.js';
import { feedbackDialog } from './feedback.js';
import { icon } from './icons.js';
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
  if (page === 'tilbakemeldinger' && me.profile.is_admin) return feedbackView();
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
        isAdmin ? tab('#/brukere', 'users', t('nav.users')) : null,
        isAdmin ? tab('#/tilbakemeldinger', 'feedback', [t('nav.feedback'), h('span', { class: 'badge fb-count hidden' })]) : null),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn ghost small', onclick: () => feedbackDialog({ name: me?.profile?.name, email: me?.user?.email }, 'lærer', () => (location.hash === '#/tilbakemeldinger' ? feedbackView() : updateFeedbackBadge())) }, [icon('mail'), t('fb.button')]),
      h('span', { class: 'who' }, me?.profile?.name || me?.user?.email || ''),
      langButton(route),
      h('button', { class: 'btn ghost small', onclick: async () => { await backend.signOut(); route(); } }, t('nav.logout'))),
    h('main', { class: 'tmain' }, content));
  if (isAdmin) updateFeedbackBadge();
}

async function updateFeedbackBadge() {
  try {
    const n = (await backend.listFeedback()).filter(f => !f.handled).length;
    const el = document.querySelector('.fb-count');
    if (el) { el.textContent = n; el.classList.toggle('hidden', !n); }
  } catch { /* tabellen finnes kanskje ikke ennå */ }
}

// ---------- Tilbakemeldinger (bare administrator) ----------
async function feedbackView() {
  shell(h('div', { class: 'spinner' }), 'feedback');
  let list;
  try { list = await backend.listFeedback(); }
  catch (e) { return shell(h('div', null, h('h1', null, t('nav.feedback')), h('p', { class: 'form-error' }, t('fb.missingTable'))), 'feedback'); }
  const item = f => h('article', { class: 'fb-item' + (f.handled ? ' done' : '') },
    h('div', { class: 'fb-meta' },
      h('b', null, f.name || t('fb.anonymous')),
      f.email ? h('a', { href: 'mailto:' + f.email }, f.email) : null,
      h('span', { class: 'muted' }, fmtDate(f.created_at, lang) + ' · ' + new Date(f.created_at).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'nb-NO', { hour: '2-digit', minute: '2-digit' })),
      f.page ? h('span', { class: 'fb-page' }, f.page) : null),
    h('p', { class: 'fb-msg' }, f.message),
    h('div', { class: 'row' },
      h('button', { class: 'btn ghost small', onclick: async () => {
        try { await backend.updateFeedback(f.id, { handled: !f.handled }); feedbackView(); } catch (e) { toast(errMsg(e), 'bad'); }
      } }, f.handled ? t('fb.markNew') : '✓ ' + t('fb.markDone')),
      h('button', { class: 'btn ghost small danger-text', onclick: async () => {
        if (!(await confirmBox(t('common.delete'), t('fb.deleteConfirm'), t('common.delete'), t('common.cancel')))) return;
        try { await backend.deleteFeedback(f.id); feedbackView(); } catch (e) { toast(errMsg(e), 'bad'); }
      } }, t('common.delete'))));
  const open = list.filter(f => !f.handled), done = list.filter(f => f.handled);
  shell(h('div', null,
    h('h1', null, t('nav.feedback')),
    !list.length ? h('div', { class: 'empty' }, questionSvg(70), h('p', null, t('fb.none'))) : null,
    open.map(item),
    done.length ? h('details', { class: 'fb-done' }, h('summary', null, t('fb.handled', { n: done.length })), done.map(item)) : null), 'feedback');
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
  knownLabels = labelsOf(mine);
  const search = h('input', { type: 'search', class: 'search', placeholder: t('list.search'), oninput: () => draw() });
  const grid = h('div', { class: 'cards' });
  // Etiketter: trykk for å vise bare kwest med den etiketten.
  let active = (() => { try { return localStorage.getItem('kwest-label-' + which) || ''; } catch { return ''; } })();
  const labels = labelsOf(base);
  if (!labels.some(l => l.toLowerCase() === active.toLowerCase())) active = '';
  const filters = h('div', { class: 'label-filter' });
  const drawFilters = () => {
    clear(filters);
    if (!labels.length) return;
    filters.append(icon('tag', 16), ...[[t('labels.all'), ''], ...labels.map(l => [l, l])].map(([name, v]) =>
      h('button', { class: 'label-chip' + (active === v ? ' on' : ''), onclick: () => {
        active = v;
        try { localStorage.setItem('kwest-label-' + which, v); } catch { /* ignorer */ }
        drawFilters(); draw();
      } }, name)));
  };
  const draw = () => {
    const s = search.value.trim().toLowerCase();
    const list = base.filter(r => (!s || (r.title + ' ' + (r.description || '') + ' ' + (r.owner_name || '') + ' ' + (r.labels || []).join(' ')).toLowerCase().includes(s))
      && (!active || (r.labels || []).some(l => l.toLowerCase() === active.toLowerCase())));
    clear(grid);
    if (!list.length) grid.append(h('div', { class: 'empty' }, questionSvg(70), h('p', null, which === 'mine' && !s ? t('list.emptyMine') : t('list.empty'))));
    list.forEach(r => grid.append(card(r, () => listView(which))));
  };
  drawFilters();
  draw();
  shell(h('div', null,
    h('div', { class: 'list-head' },
      h('h1', null, which === 'mine' ? t('nav.mine') : t('nav.all')),
      h('span', { class: 'spacer' }),
      search,
      h('button', { class: 'btn ghost', onclick: () => importDialog() }, [icon('upload'), t('list.import')]),
      h('button', { class: 'btn ghost', onclick: () => aiDialog() }, [icon('sparkle'), t('list.ai')]),
      h('a', { class: 'btn primary', href: '#/ny' }, '+ ' + t('list.new'))),
    filters,
    grid), which);
}

// ---------- Etiketter (mapper) ----------
let knownLabels = [];
function cleanLabels(list) {
  const out = [];
  for (const raw of list || []) {
    const l = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 30);
    if (l && !out.some(x => x.toLowerCase() === l.toLowerCase())) out.push(l);
  }
  return out.slice(0, 8);
}
function labelsOf(rows) {
  const out = [];
  for (const l of rows.flatMap(r => r.labels || [])) if (!out.some(x => x.toLowerCase() === String(l).toLowerCase())) out.push(String(l));
  return out.sort((a, b) => a.localeCompare(b, 'nb'));
}

// Felt for å legge til og fjerne etiketter. onChange får den nye listen.
function labelEditor(initial, onChange) {
  let list = cleanLabels(initial);
  const chips = h('div', { class: 'label-chips' });
  const listId = 'labels-' + uid(6);
  const input = h('input', { type: 'text', maxlength: '30', list: listId, placeholder: t('labels.addPh'),
    onkeydown: e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } } });
  const add = () => {
    const v = input.value.replace(/,/g, ' ').trim();
    if (!v) return;
    list = cleanLabels([...list, v]);
    input.value = '';
    draw(); onChange(list);
  };
  const draw = () => {
    clear(chips);
    list.forEach(l => chips.append(h('span', { class: 'label-chip on' }, l,
      h('button', { class: 'label-x', type: 'button', 'aria-label': t('common.delete') + ' ' + l, onclick: () => { list = list.filter(x => x !== l); draw(); onChange(list); } }, '✕'))));
    if (!list.length) chips.append(h('span', { class: 'muted small-text' }, t('labels.none')));
  };
  draw();
  return h('div', { class: 'stack label-editor' }, chips,
    h('div', { class: 'row' }, input, h('button', { class: 'btn ghost small', type: 'button', onclick: add }, t('labels.add'))),
    h('datalist', { id: listId }, knownLabels.map(l => h('option', { value: l }))),
    h('small', { class: 'muted' }, t('labels.help')));
}

async function labelsDialog(r, refresh) {
  try {
    const full = await backend.getQuiz(r.id);
    let next = full.data?.labels || [];
    modal(t('labels.title'), labelEditor(next, l => { next = l; }), [
      h('button', { class: 'btn primary', onclick: async e => {
        e.target.closest('.modal-wrap').remove();
        try {
          await backend.saveQuiz({ id: full.id, title: full.title, description: full.description, data: { ...full.data, labels: next } });
          refresh();
        } catch (err) { toast(errMsg(err), 'bad'); }
      } }, t('common.save')),
    ]);
  } catch (e) { toast(errMsg(e), 'bad'); }
}

function canEdit(row) { return row.owner === me.user.id || me.profile.is_admin; }

function card(r, refresh) {
  const editable = canEdit(r);
  return h('article', { class: 'card' },
    h('a', { class: 'card-main', href: '#/rediger/' + r.id },
      h('span', { class: 'card-mark' }, questionSvg(34)),
      h('div', null,
        h('h3', null, r.is_private ? h('span', { class: 'priv', title: t('ed.privateBadge') }, icon('lock', 15)) : null, r.title || t('list.untitled')),
        r.description ? h('p', { class: 'card-desc' }, r.description) : null,
        r.labels?.length ? h('p', { class: 'card-labels' }, r.labels.map(l => h('span', { class: 'label-chip small' }, l))) : null,
        h('p', { class: 'card-meta' }, t('list.questions', { n: r.question_count ?? '?' }),
          r.owner !== me.user.id && r.owner_name ? ' · ' + t('list.by', { name: r.owner_name }) : '',
          ' · ' + fmtDate(r.updated_at, lang)))),
    h('div', { class: 'card-actions' },
      h('a', { class: 'btn primary small', href: 'host.html?id=' + r.id }, '▶ ' + t('list.play')),
      editable
        ? h('a', { class: 'btn ghost small', href: '#/rediger/' + r.id }, t('list.edit'))
        : h('button', { class: 'btn ghost small', onclick: () => copyQuiz(r) }, t('list.copy')),
      moreMenu([
        editable ? [t('list.copy'), () => copyQuiz(r)] : null,
        editable ? [t('labels.title'), () => labelsDialog(r, refresh)] : null,
        [t('list.export'), () => exportRow(r)],
        editable ? [t('list.delete'), async () => {
          if (!(await confirmBox(t('list.delete'), t('list.deleteConfirm', { title: r.title }), t('common.delete'), t('common.cancel')))) return;
          try { await backend.deleteQuiz(r.id); refresh(); } catch (e) { toast(errMsg(e), 'bad'); }
        }, 'danger-text'] : null,
      ])));
}

// Liten «⋯»-meny for sjeldnere valg.
function moreMenu(items) {
  const menu = h('div', { class: 'menu hidden', role: 'menu' }, items.filter(Boolean).map(([label, fn, cls]) =>
    h('button', { class: 'menu-item ' + (cls || ''), role: 'menuitem', onclick: () => { menu.classList.add('hidden'); fn(); } }, label)));
  const btn = h('button', { class: 'icon-btn', 'aria-label': t('list.more'), title: t('list.more'), 'aria-haspopup': 'menu', onclick: e => {
    e.stopPropagation();
    document.querySelectorAll('.menu').forEach(m => m !== menu && m.classList.add('hidden'));
    menu.classList.toggle('hidden');
  } }, icon('more'));
  return h('div', { class: 'menu-wrap' }, btn, menu);
}
document.addEventListener('click', () => document.querySelectorAll('.menu').forEach(m => m.classList.add('hidden')));

async function copyQuiz(r) {
  try {
    const full = await backend.getQuiz(r.id);
    const saved = await backend.saveQuiz({ title: t('list.copyOf', { title: full.title }), description: full.description, data: full.data, is_private: full.owner === me.user.id ? !!full.is_private : undefined });
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
  const EXP = no ? '1–3 setninger om hvorfor riktig svar er riktig' : '1–3 sentences on why the correct answer is correct';
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
    '',
    'VIKTIG om feltet "explanation":',
    '- ALLE spørsmål (unntatt "info") SKAL ha feltet "explanation".',
    '- Det skal ligge direkte i spørsmålet, på samme nivå som "text" – aldri inne i "options", "answers" eller "items".',
    '- Innhold: 1–3 setninger (maks ca. 400 tegn) som forklarer HVORFOR riktig svar er riktig, gjerne med en nyttig tilleggsopplysning. Bygg på materialet. Elevene ser teksten etter at de har svart.',
    '- For "poll" og "wordcloud" (uten fasit): skriv et kort faglig poeng eller en refleksjon knyttet til spørsmålet.',
    extra ? `- Ekstra ønsker fra læreren: ${extra}` : null,
    '',
    'SVARFORMAT: Svar med gyldig JSON i nøyaktig formatet under. Legg HELE svaret i ÉN kodeblokk som starter med ```json og slutter med ``` (slik at det får en kopieringsknapp). Ingen annen tekst før eller etter kodeblokken, og ikke lag et eget dokument eller artifact.',
    '',
    'Format:',
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
    '',
    'IMPORTANT about the "explanation" field:',
    '- EVERY question (except "info") MUST have the field "explanation".',
    '- It goes directly in the question object, at the same level as "text" – never inside "options", "answers" or "items".',
    '- Content: 1–3 sentences (max ~400 characters) explaining WHY the correct answer is correct, ideally with a useful extra fact. Base it on the material. Students see it after answering.',
    '- For "poll" and "wordcloud" (no right answer): write a short teaching point or reflection related to the question.',
    extra ? `- Extra wishes from the teacher: ${extra}` : null,
    '',
    'ANSWER FORMAT: Reply with valid JSON in exactly the format below. Put the ENTIRE answer in ONE code block that starts with ```json and ends with ``` (so it gets a copy button). No other text before or after the code block, and do not create a separate document or artifact.',
    '',
    'Format:',
  ];
  const ex = (o) => ({ ...o, explanation: EXP });
  const example = {
    kwest: 1, title: no ? 'Tittel' : 'Title', description: no ? 'Kort beskrivelse' : 'Short description',
    questions: [
      ex({ type: 'quiz', text: '…', time: 20, points: 'standard', options: [{ text: '…', correct: true }, { text: '…', correct: false }, { text: '…', correct: false }, { text: '…', correct: false }] }),
      ex({ type: 'truefalse', text: '…', time: 10, correct: true }),
      ex({ type: 'short', text: '…', time: 30, answers: [no ? 'svar' : 'answer', no ? 'annen skrivemåte' : 'alternative spelling'] }),
      ex({ type: 'slider', text: '…', time: 30, min: 0, max: 100, step: 1, correct: 42, tolerance: 3, unit: 'mg' }),
      ex({ type: 'order', text: '…', time: 30, items: [no ? 'første' : 'first', no ? 'andre' : 'second', no ? 'tredje' : 'third', no ? 'fjerde' : 'fourth'] }),
      ex({ type: 'poll', text: '…', time: 20, options: [{ text: '…' }, { text: '…' }] }),
      ex({ type: 'wordcloud', text: '…', time: 30, maxWords: 1 }),
      { type: 'info', text: '…' },
    ],
  };
  const notes = no ? [
    '',
    'Merknader til feltene: "time" er sekunder (5–240). "order": skriv elementene i RIKTIG rekkefølge (2–4 stk). "slider": "tolerance" er hvor langt unna som regnes som riktig. "short": list alle skrivemåter som skal godtas. "info" er en ren tekstside uten spørsmål og uten "explanation".',
    'Sjekk til slutt at hvert spørsmål unntatt "info" har en utfylt "explanation".',
    '',
    'HUSK: Hele svaret skal stå i én kodeblokk som starter med ```json – ingenting annet.',
  ] : [
    '',
    'Field notes: "time" is seconds (5–240). "order": list the items in the CORRECT order (2–4). "slider": "tolerance" is how far off still counts as correct. "short": list every spelling to accept. "info" is a plain text slide without a question and without "explanation".',
    'Finally, check that every question except "info" has a filled-in "explanation".',
    '',
    'REMEMBER: The entire answer must be in one code block starting with ```json – nothing else.',
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
const E = { id: null, owner: null, readonly: false, quiz: null, sel: 0, dirty: false, saving: null, pending: false, undo: [], redo: [], cur: '', groupAt: 0, groupEl: null };

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
      E.quiz = { title: row.title, description: row.description || '', is_private: !!row.is_private, labels: cleanLabels(row.data?.labels), settings: { leaderboard: true, shuffle: false, ...(row.data?.settings || {}) }, questions: row.data?.questions || [] };
      E.quiz.questions.forEach(q => { q.id ||= uid(8); });
      if (!E.quiz.questions.length) E.quiz.questions.push(newQuestion('quiz'));
      if (E.readonly) {
        const all = await backend.listQuizzes().catch(() => []);
        E.ownerName = all.find(r => r.id === id)?.owner_name || '';
      }
    } catch (e) { return shell(h('p', { class: 'form-error' }, errMsg(e))); }
  }
  Object.assign(E, { undo: [], redo: [], cur: snapshot(), groupAt: 0, groupEl: null });
  drawEditor();
}

// ---------- Angre / gjør om ----------
// Skriving i samme felt samles til ett angresteg; alt annet (slette, flytte, legge til …) er egne steg.
function snapshot() {
  const { title, description, is_private, labels, settings, questions } = E.quiz;
  return JSON.stringify({ title, description, is_private, labels, settings, questions });
}
function recordUndo() {
  const snap = snapshot();
  if (snap === E.cur) return;
  const el = document.activeElement;
  const typing = el && el === E.groupEl && el.matches('textarea, input:not([type=checkbox]):not([type=file])') && Date.now() - E.groupAt < 1500;
  if (!typing) {
    E.undo.push(E.cur);
    if (E.undo.length > 60) E.undo.shift();
  }
  E.groupEl = el; E.groupAt = Date.now();
  E.cur = snap;
  E.redo = [];
  updateUndoButtons();
}
function undo(back = true) {
  if (E.readonly) return;
  const from = back ? E.undo : E.redo, to = back ? E.redo : E.undo;
  if (!from.length) return;
  to.push(E.cur);
  E.cur = from.pop();
  Object.assign(E.quiz, JSON.parse(E.cur));
  E.groupEl = null;
  E.sel = Math.max(0, Math.min(E.sel, E.quiz.questions.length - 1));
  E.dirty = true;
  autosave();
  drawEditor();
  setStatus('unsaved');
  toast(back ? t('ed.undone') : t('ed.redone'));
}
function updateUndoButtons() {
  const u = document.querySelector('.undo-btn'), r = document.querySelector('.redo-btn');
  if (u) u.disabled = !E.undo.length;
  if (r) r.disabled = !E.redo.length;
}
document.addEventListener('keydown', e => {
  if (!document.querySelector('.ed-panel') || E.readonly || !(e.ctrlKey || e.metaKey)) return;
  const k = e.key.toLowerCase();
  if (k !== 'z' && k !== 'y') return;
  // Inne i et tekstfelt angrer nettleseren selv skrivingen.
  if (e.target.matches('input, textarea') || document.querySelector('.modal-wrap')) return;
  e.preventDefault();
  undo(!(k === 'y' || e.shiftKey));
});

const autosave = debounce(() => saveNow(), 1200);
function changed() {
  if (E.readonly) return;
  recordUndo();
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
  const payload = { id: E.id, title: q.title.trim() || t('list.untitled'), description: q.description.trim(), is_private: !!q.is_private, data: { settings: q.settings, questions: q.questions, labels: cleanLabels(q.labels) } };
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
      E.quiz.is_private ? h('span', { class: 'priv-chip' }, icon('lock', 14), t('ed.privateBadge')) : null,
      E.readonly ? null : h('div', { class: 'undo-group' },
        h('button', { class: 'icon-btn undo-btn', title: t('ed.undo'), 'aria-label': t('ed.undo'), disabled: !E.undo.length, onclick: () => undo(true) }, icon('undo')),
        h('button', { class: 'icon-btn redo-btn', title: t('ed.redo'), 'aria-label': t('ed.redo'), disabled: !E.redo.length, onclick: () => undo(false) }, icon('redo'))),
      h('button', { class: 'btn ghost', onclick: settingsDialog, disabled: E.readonly }, '⚙ ' + t('ed.settings')),
      E.readonly ? h('button', { class: 'btn ghost', onclick: () => copyQuiz({ id: E.id }) }, t('list.copy')) : null,
      startBtn),
    E.readonly ? h('p', { class: 'notice' }, t('ed.readonly', { name: E.ownerName || '?' })) : null,
    h('div', { class: 'ed-body' },
      h('aside', { class: 'ed-side' }, h('ol', { class: 'qlist' }), E.readonly ? null : addButton(),
        E.readonly ? null : h('button', { class: 'btn ghost small bank-btn', onclick: bankDialog }, [icon('bank', 16), t('bank.button')])),
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
    // Egen poengtavle-side: da skal den ikke i tillegg vises automatisk etter hvert spørsmål.
    if (type === 'scoreboard' && E.quiz.settings.leaderboard !== false) {
      E.quiz.settings.leaderboard = false;
      toast(t('ed.autoBoardOff'));
    }
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
        h('span', { class: 'qitem-text' }, q.type === 'scoreboard' ? t('ed.scoreboardShort') : q.text || '…')),
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
    fresh.id = q.id; fresh.text = q.text; fresh.image = q.image; fresh.audio = q.audio; fresh.autoplay = q.autoplay; fresh.explanation = q.explanation || '';
    if (type !== 'info' && q.type !== 'info' && q.time) fresh.time = q.time;
    // Ta med svaralternativene der det gir mening.
    const texts = q.options ? q.options.map(o => o.text) : q.items ? q.items : null;
    if (texts && fresh.options) fresh.options = texts.map((text, i) => (type === 'quiz' ? { text, correct: q.options ? !!q.options[i]?.correct : i === 0 } : { text }));
    if (texts && fresh.items) fresh.items = texts.slice();
    E.quiz.questions[E.sel] = fresh;
    if (type === 'scoreboard' && E.quiz.settings.leaderboard !== false) { E.quiz.settings.leaderboard = false; toast(t('ed.autoBoardOff')); }
    rerender();
  };

  const tools = h('div', { class: 'panel-tools' },
    h('label', { class: 'field' }, h('span', null, t('ed.type')), select(TYPES.map(x => [x, TYPE_ICONS[x] + ' ' + t('type.' + x)]), q.type, changeType, ro)),
    q.type !== 'info' && q.type !== 'scoreboard' ? h('label', { class: 'field' }, h('span', null, t('ed.time')), select(TIMES.map(s => [s, t('ed.seconds', { n: s })]), q.time, v => { q.time = Number(v); changed(); }, ro)) : null,
    ['quiz', 'truefalse', 'short', 'slider', 'order'].includes(q.type) ? h('label', { class: 'field' }, h('span', null, t('ed.points')),
      select([['standard', t('ed.pStandard')], ['double', t('ed.pDouble')], ['none', t('ed.pNone')]], q.points, v => { q.points = v; changed(); }, ro)) : null,
    h('span', { class: 'spacer' }),
    ro ? null : h('div', { class: 'qtools' },
      h('button', { class: 'icon-btn', title: t('ed.moveUp'), disabled: E.sel === 0, onclick: () => move(-1) }, icon('up')),
      h('button', { class: 'icon-btn', title: t('ed.moveDown'), disabled: E.sel === E.quiz.questions.length - 1, onclick: () => move(1) }, icon('down')),
      h('button', { class: 'icon-btn', title: t('ed.duplicate'), onclick: () => {
        const copy = JSON.parse(JSON.stringify(q)); copy.id = uid(8);
        E.quiz.questions.splice(E.sel + 1, 0, copy); E.sel++; rerender();
      } }, icon('copy')),
      h('button', { class: 'icon-btn danger-text', title: t('ed.deleteQ'), disabled: E.quiz.questions.length === 1, onclick: () => {
        E.quiz.questions.splice(E.sel, 1); E.sel = Math.max(0, E.sel - 1); rerender();
      } }, icon('trash'))));

  const text = h('textarea', { class: 'q-text', rows: '2', maxlength: '400', placeholder: q.type === 'info' ? t('ed.infoPh') : t('ed.questionPh'), disabled: ro,
    oninput: e => { q.text = e.target.value; changed(); refreshItem(); } });
  text.value = q.text;

  if (q.type === 'scoreboard') {
    panel.append(tools, h('div', { class: 'q-slide board-slide' },
      h('div', { class: 'board-preview' }, questionSvg(46), exclamationSvg(46)),
      h('p', null, t('ed.scoreboardInfo'))));
    return;
  }
  panel.append(tools,
    h('div', { class: 'q-slide' },
      h('div', { class: 'q-slide-head' }, h('span', { class: 'q-mark' }, q.type === 'info' ? exclamationSvg(40) : questionSvg(40)), text),
      imageBox(q, ro),
      audioBox(q, ro),
      typeEditor(q, ro, rerender),
      q.type === 'info' ? null : explanationField(q, ro)));

  const issues = validateQuiz(E.quiz).filter(x => x.index === E.sel);
  if (issues.length) panel.append(h('p', { class: 'q-issues' }, '⚠ ' + issues.map(x => t(x.key)).join(', ')));
}

function explanationField(q, ro) {
  const ta = h('textarea', { class: 'exp-input', rows: '3', maxlength: '600', disabled: ro, placeholder: t('ed.explanationPh'),
    oninput: e => { q.explanation = e.target.value; changed(); } });
  ta.value = q.explanation || '';
  return h('label', { class: 'field exp-field' },
    h('span', null, icon('book', 15), ' ', t('ed.explanation'), h('span', { class: 'tag' }, t('ed.optional'))),
    ta, h('small', { class: 'muted' }, t('ed.explanationHint')));
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
  }, h('span', { class: 'img-plus' }, icon('image', 30)), h('span', null, t('ed.imageHint')), input);
  return box;
}

async function setImage(q, file) {
  try {
    const dataUrl = await readImage(file);
    if (backend.mode === 'demo' && dataUrl.length > 1_500_000) return toast(t('ed.tooBig'), 'bad');
    toast(t('ed.uploading'));
    const blob = await (await fetch(dataUrl)).blob();
    q.image = await backend.uploadMedia(blob, blob.type === 'image/png' ? 'png' : 'jpg');
    changed(); drawList(); drawPanel();
  } catch (e) { toast(errMsg(e), 'bad'); }
}

const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|oga|webm|flac)$/i;
function isAudio(f) { return f && (f.type.startsWith('audio/') || AUDIO_EXT.test(f.name || '')); }

async function setAudio(q, file) {
  try {
    if (!isAudio(file)) return toast(t('ed.notAudio'), 'bad');
    if (file.size > 20_000_000) return toast(t('ed.audioTooBig'), 'bad');
    toast(t('ed.uploading'));
    const ext = (file.name.match(AUDIO_EXT)?.[1] || (file.type.split('/')[1] || 'mp3').replace('mpeg', 'mp3')).toLowerCase();
    q.audio = await backend.uploadMedia(file, ext);
    changed(); drawList(); drawPanel();
  } catch (e) { toast(errMsg(e), 'bad'); }
}

// Lim inn bilde eller lydfil fra utklippstavlen i redigeringen.
document.addEventListener('paste', e => {
  if (!document.querySelector('.ed-panel') || E.readonly) return;
  const files = [...(e.clipboardData?.files || [])];
  const img = files.find(f => f.type.startsWith('image/'));
  const snd = files.find(isAudio);
  if (snd) { e.preventDefault(); setAudio(E.quiz.questions[E.sel], snd); }
  else if (img) { e.preventDefault(); setImage(E.quiz.questions[E.sel], img); }
});

function audioBox(q, ro) {
  if (q.audio) {
    const warn = h('p', { class: 'form-error' });
    const player = h('audio', { src: q.audio, controls: true, preload: 'metadata', onerror: () => { warn.textContent = t('ed.audioBroken'); } });
    return h('div', { class: 'audio-edit' },
      h('span', { class: 'audio-icon' }, icon('sound', 24)),
      h('div', { class: 'grow stack' }, player, warn,
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: q.autoplay !== false, disabled: ro, onchange: e => { q.autoplay = e.target.checked; changed(); } }), t('ed.autoplay'))),
      ro ? null : h('button', { class: 'btn ghost small', onclick: () => { q.audio = ''; changed(); drawPanel(); } }, t('ed.removeAudio')));
  }
  if (ro) return null;
  const file = h('input', { type: 'file', accept: 'audio/*,.mp3,.wav,.m4a,.ogg', class: 'hidden', onchange: () => file.files[0] && setAudio(q, file.files[0]) });
  const url = h('input', { type: 'url', placeholder: t('ed.audioUrlPh') });
  const useUrl = () => {
    const v = url.value.trim();
    if (!/^https:\/\//i.test(v)) return toast(t('ed.audioUrlBad'), 'bad');
    q.audio = v; changed(); drawPanel();
  };
  url.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); useUrl(); } });
  const box = h('div', { class: 'audio-add',
    ondragover: e => { e.preventDefault(); box.classList.add('drag'); },
    ondragleave: () => box.classList.remove('drag'),
    ondrop: e => { e.preventDefault(); box.classList.remove('drag'); const f = e.dataTransfer.files[0]; if (f) setAudio(q, f); },
  },
    h('span', { class: 'audio-icon' }, icon('sound', 24)),
    h('div', { class: 'grow stack' },
      h('b', null, t('ed.audio')),
      h('div', { class: 'row' }, url, h('button', { class: 'btn ghost small', onclick: useUrl }, t('ed.useUrl')),
        h('button', { class: 'btn ghost small', onclick: () => file.click() }, t('ed.uploadAudio'))),
      h('small', { class: 'muted' }, t('ed.audioHint'))), file);
  return box;
}

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

// ---------- Spørsmålsbank: hent enkeltspørsmål fra andre kwest ----------
async function bankDialog() {
  const body = h('div', { class: 'stack bank' }, h('div', { class: 'spinner' }));
  const addBtn = h('button', { class: 'btn primary', disabled: true }, t('bank.add', { n: 0 }));
  const m = modal(t('bank.title'), body, [addBtn]);
  m.el.querySelector('.modal').classList.add('wide');
  let rows;
  try { rows = await backend.listBank(); }
  catch (e) { clear(body).append(h('p', { class: 'form-error' }, errMsg(e))); return; }
  const picked = new Map(); // nøkkel -> spørsmål
  const items = [];
  for (const r of rows) {
    if (r.id === E.id) continue;
    (r.data?.questions || []).forEach((q, i) => {
      if (!q || q.type === 'scoreboard') return;
      const hay = [q.text, q.explanation, ...(q.options || []).map(o => o.text), ...(q.items || []), ...(q.answers || [])].join(' ').toLowerCase();
      items.push({ key: r.id + ':' + i, q, quiz: r, hay: hay + ' ' + (r.title || '').toLowerCase() });
    });
  }
  const search = h('input', { type: 'search', class: 'search wide', placeholder: t('bank.search'), oninput: () => draw() });
  const list = h('div', { class: 'bank-list' });
  const update = () => { addBtn.disabled = !picked.size; addBtn.textContent = t('bank.add', { n: picked.size }); };
  const draw = () => {
    const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = items.filter(x => words.every(w => x.hay.includes(w))).slice(0, 150);
    clear(list);
    if (!hits.length) { list.append(h('p', { class: 'muted' }, items.length ? t('bank.none') : t('bank.empty'))); return; }
    let lastQuiz = null;
    for (const x of hits) {
      if (x.quiz !== lastQuiz) {
        lastQuiz = x.quiz;
        list.append(h('h4', { class: 'bank-quiz' }, x.quiz.title || t('list.untitled'), x.quiz.owner !== me.user.id && x.quiz.owner_name ? h('span', { class: 'muted' }, ' · ' + t('list.by', { name: x.quiz.owner_name })) : null));
      }
      const correct = x.q.type === 'quiz' ? (x.q.options || []).filter(o => o.correct).map(o => o.text).join(' / ') : '';
      list.append(h('label', { class: 'bank-item' + (picked.has(x.key) ? ' on' : '') },
        h('input', { type: 'checkbox', checked: picked.has(x.key), onchange: e => {
          if (e.target.checked) picked.set(x.key, x.q); else picked.delete(x.key);
          e.target.closest('.bank-item').classList.toggle('on', e.target.checked);
          update();
        } }),
        h('span', { class: 'qitem-type' }, TYPE_ICONS[x.q.type] || ''),
        h('span', { class: 'bank-text' }, h('b', null, x.q.text || t('type.' + x.q.type)), correct ? h('small', { class: 'muted block' }, '✓ ' + correct) : null),
        x.q.image ? h('img', { class: 'qitem-img', src: x.q.image, alt: '' }) : null));
    }
  };
  clear(body).append(h('p', { class: 'muted' }, t('bank.intro')), search, list);
  draw();
  setTimeout(() => search.focus(), 30);
  addBtn.onclick = () => {
    const copies = [...picked.values()].map(q => ({ ...JSON.parse(JSON.stringify(q)), id: uid(8) }));
    E.quiz.questions.splice(E.sel + 1, 0, ...copies);
    E.sel += copies.length;
    m.close();
    changed(); drawList(); drawPanel();
    toast(t('bank.added', { n: copies.length }), 'ok');
  };
}

function settingsDialog() {
  const q = E.quiz;
  const desc = h('textarea', { rows: '2', placeholder: t('ed.description') });
  desc.value = q.description;
  modal(t('ed.settings'), h('div', { class: 'stack' },
    h('label', { class: 'field' }, h('span', null, t('ed.description')), desc),
    h('div', { class: 'field' }, h('span', null, icon('tag', 15), ' ', t('labels.title')), labelEditor(q.labels || [], l => { q.labels = l; changed(); })),
    h('label', { class: 'check top' }, h('input', { type: 'checkbox', checked: !!q.is_private, onchange: e => {
      if (!backend.hasPrivate) { e.target.checked = false; return toast(t('ed.privateMissing'), 'bad'); }
      q.is_private = e.target.checked; changed(); drawEditor();
    } }), h('span', null, h('b', null, t('ed.private')), h('small', { class: 'muted block' }, t('ed.privateHelp')))),
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
  // På Vercel heter siden bare «/studio»; lokalt trengs «.html».
  const link = baseUrl() + (location.pathname.endsWith('.html') ? 'studio.html' : 'studio');
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
