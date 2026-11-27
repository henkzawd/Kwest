// Personvernsiden: hva Kwest lagrer (og ikke lagrer), på norsk og engelsk.
import { h, clear } from './util.js';
import { t, langButton } from './i18n.js';
import { wordmark, setFavicon } from './logo.js';

setFavicon();
const app = document.getElementById('app');
const SECTIONS = ['students', 'after', 'homework', 'teachers', 'feedback', 'claude', 'storage', 'device', 'patients', 'contact'];

function render() {
  document.title = t('priv.title');
  clear(app);
  app.append(h('div', { class: 'auth' },
    h('div', { class: 'auth-top' }, langButton(render)),
    h('article', { class: 'auth-card privacy-card' },
      h('a', { class: 'auth-logo', href: '/' }, wordmark(56)),
      h('h1', null, t('priv.title')),
      h('p', { class: 'auth-intro' }, t('priv.intro')),
      SECTIONS.map(k => h('section', null, h('h2', null, t('priv.' + k + 'H')), h('p', null, t('priv.' + k)))),
      h('p', { class: 'muted small-text' }, t('priv.updated')),
      h('a', { class: 'btn ghost', href: '/' }, '← ' + t('priv.back')))));
}
render();
