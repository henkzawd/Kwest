// Kwest-logoen: et gult utropstegn (oppdrag!) og et gult spørsmålstegn for hvert spørsmål.
import { svg } from './util.js';

let n = 0;

function grad(id) {
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFE45C"/><stop offset=".55" stop-color="#FFC400"/><stop offset="1" stop-color="#F29A00"/>
  </linearGradient></defs>`;
}

export function exclamationSvg(size = 48) {
  const id = 'kwg' + (n++);
  return svg(`<svg class="mark" width="${size * 0.64}" height="${size}" viewBox="0 0 64 100" aria-hidden="true">${grad(id)}
    <polygon points="17,7 47,7 39,64 25,64" fill="url(#${id})" stroke="#3B2A00" stroke-width="5" stroke-linejoin="round"/>
    <polygon points="24,13 33,13 30,52 27,52" fill="#FFF6C2" opacity=".75"/>
    <circle cx="32" cy="83" r="10.5" fill="url(#${id})" stroke="#3B2A00" stroke-width="5"/>
  </svg>`);
}

export function questionSvg(size = 48) {
  const id = 'kwq' + (n++);
  return svg(`<svg class="mark" width="${size * 0.64}" height="${size}" viewBox="0 0 64 100" aria-hidden="true">${grad(id)}
    <path d="M15 31 C15 10, 50 6, 50 29 C50 44, 32 45, 32 62" fill="none" stroke="#3B2A00" stroke-width="23" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M15 31 C15 10, 50 6, 50 29 C50 44, 32 45, 32 62" fill="none" stroke="url(#${id})" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="32" cy="85" r="10.5" fill="url(#${id})" stroke="#3B2A00" stroke-width="5"/>
  </svg>`);
}

export function wordmark(size = 40) {
  const wrap = document.createElement('span');
  wrap.className = 'wordmark';
  wrap.append(exclamationSvg(size));
  const t = document.createElement('span');
  t.className = 'wordmark-text';
  t.style.fontSize = (size * 0.8) + 'px';
  t.textContent = 'Kwest';
  wrap.append(t);
  return wrap;
}

// Ikon for nettleserfanen.
export function setFavicon() {
  const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 100"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE45C"/><stop offset="1" stop-color="#F29A00"/></linearGradient></defs><polygon points="17,7 47,7 39,64 25,64" fill="url(#g)" stroke="#3B2A00" stroke-width="5" stroke-linejoin="round"/><circle cx="32" cy="83" r="10.5" fill="url(#g)" stroke="#3B2A00" stroke-width="5"/></svg>`;
  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = 'data:image/svg+xml,' + encodeURIComponent(s);
  document.head.append(link);
}
