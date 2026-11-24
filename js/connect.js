// Kobling til Claude: forklarer hvordan man kobler til, og er siden der læreren
// logger inn og godkjenner at Claude får lage og endre kwest på kontoen (OAuth-samtykke).
import { h, clear, copyText, toast } from './util.js';
import { t, langButton } from './i18n.js';
import { backend } from './backend.js';
import { wordmark, exclamationSvg, setFavicon } from './logo.js';

setFavicon();
const app = document.getElementById('app');
const authId = new URLSearchParams(location.search).get('authorization_id');
export const MCP_URL = location.origin + '/mcp';

function errMsg(e) { return t('common.error', { msg: e?.message || String(e) }); }

function page(...content) {
  clear(app);
  app.append(h('div', { class: 'auth' },
    h('div', { class: 'auth-top' }, langButton(route)),
    h('div', { class: 'auth-card connect-card' }, h('div', { class: 'auth-logo' }, wordmark(56)), ...content)));
}

// Fremgangsmåten for å legge Kwest til i Claude (vises også fra Kwest Studio).
export function connectSteps() {
  return h('div', { class: 'connect-steps' },
    h('ol', null,
      h('li', null, t('conn.s1')),
      h('li', null, t('conn.s2'), h('div', { class: 'copy-url' },
        h('code', null, MCP_URL),
        h('button', { class: 'btn ghost small', type: 'button', onclick: async () => { if (await copyText(MCP_URL)) toast(t('conn.copied'), 'ok'); } }, t('conn.copy')))),
      h('li', null, t('conn.s3')),
      h('li', null, t('conn.s4'))),
    h('p', { class: 'muted small-text' }, t('conn.plans')));
}

function infoView() {
  page(
    h('h1', null, t('conn.title')),
    h('p', { class: 'auth-intro' }, t('conn.intro')),
    connectSteps(),
    h('p', { class: 'connect-example' }, t('conn.example')),
    h('a', { class: 'btn primary', href: 'https://claude.ai/customize/connectors', target: '_blank', rel: 'noopener' }, t('conn.openClaude') + ' ↗'),
    h('a', { class: 'link', href: '/studio.html' }, t('conn.toStudio')));
}

function loginView() {
  const email = h('input', { type: 'email', autocomplete: 'email', required: true, placeholder: t('auth.email'), 'aria-label': t('auth.email') });
  const pw = h('input', { type: 'password', autocomplete: 'current-password', required: true, placeholder: t('auth.password'), 'aria-label': t('auth.password') });
  const msg = h('p', { class: 'form-error', role: 'alert' });
  const btn = h('button', { class: 'btn primary wide', type: 'submit' }, t('auth.login'));
  page(
    h('h1', null, t('conn.loginTitle')),
    h('p', { class: 'auth-intro' }, t('conn.loginText')),
    h('form', { class: 'auth-form', onsubmit: async e => {
      e.preventDefault();
      msg.textContent = '';
      btn.disabled = true;
      try { await backend.signIn(email.value.trim(), pw.value); route(); }
      catch (err) { msg.textContent = /invalid login/i.test(String(err?.message)) ? t('auth.badLogin') : errMsg(err); }
      finally { btn.disabled = false; }
    } }, email, pw, msg, btn),
    h('a', { class: 'link', href: '/studio.html', target: '_blank', rel: 'noopener' }, t('conn.noAccount')));
  email.focus();
}

function doneView(url, approved) {
  page(h('div', { class: 'spinner' }), h('p', null, approved ? t('conn.back') : t('conn.denied')));
  location.replace(url);
}

async function consentView(me) {
  page(h('div', { class: 'spinner' }));
  let d;
  try { d = await backend.oauthDetails(authId); }
  catch (e) { return page(exclamationSvg(70), h('h1', null, t('conn.failTitle')), h('p', null, t('conn.failText')), h('p', { class: 'form-error' }, errMsg(e))); }
  if (d?.redirect_url) return doneView(d.redirect_url, true); // allerede godkjent tidligere
  const client = d?.client?.name || 'Claude';
  const decide = async approve => {
    buttons.forEach(b => { b.disabled = true; });
    try {
      const r = await backend.oauthDecide(authId, approve);
      if (!r?.redirect_url) throw new Error('redirect_url');
      doneView(r.redirect_url, approve);
    } catch (e) { msg.textContent = errMsg(e); buttons.forEach(b => { b.disabled = false; }); }
  };
  const msg = h('p', { class: 'form-error', role: 'alert' });
  const buttons = [
    h('button', { class: 'btn ghost', type: 'button', onclick: () => decide(false) }, t('conn.deny')),
    h('button', { class: 'btn primary', type: 'button', onclick: () => decide(true) }, t('conn.allow')),
  ];
  page(
    h('h1', null, t('conn.askTitle', { client })),
    h('p', null, t('conn.askText', { client, email: d?.user?.email || me.user.email })),
    h('ul', { class: 'connect-list' }, h('li', null, t('conn.can1')), h('li', null, t('conn.can2')), h('li', null, t('conn.cannot'))),
    msg,
    h('div', { class: 'row connect-buttons' }, ...buttons),
    h('p', { class: 'muted small-text' }, t('conn.revoke')),
    h('button', { class: 'link', type: 'button', onclick: async () => { await backend.signOut(); route(); } }, t('conn.otherUser')));
}

async function route() {
  if (!authId) return infoView();
  if (backend.mode === 'demo') return page(exclamationSvg(70), h('p', null, t('conn.demo')));
  page(h('div', { class: 'spinner' }));
  const me = await backend.session().catch(() => null);
  if (!me) return loginView();
  if (!me.profile?.approved) {
    return page(exclamationSvg(70), h('h1', null, t('auth.pending')), h('p', null, t('auth.pendingText')),
      h('button', { class: 'btn ghost', onclick: async () => { await backend.signOut(); route(); } }, t('nav.logout')));
  }
  return consentView(me);
}

// Kwest Studio henter bare fremgangsmåten herfra; selve siden startes bare på koble.html.
if (document.body.dataset.page === 'koble') route();
