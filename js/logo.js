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

// Et rolig landskap med sti opp til et flagg – bakgrunn på elevsiden.
export function landscape() {
  return svg(`<svg viewBox="0 0 400 120" preserveAspectRatio="xMidYMax slice" width="100%" height="100%">
    <path d="M0 120V78l60-30 45 22 70-52 55 38 40-20 60 34 70-26v76z" fill="#F7F3E6"/>
    <path d="M175 18l-14 10 8 2-9 9 15-6 10 6z" fill="#fff" opacity=".9"/>
    <path d="M0 120V96c50-14 90-6 140-16s90-26 150-12 80 10 110 4v48z" fill="#FFF3C4"/>
    <path d="M20 120c40-18 90-14 120-28s30-26 60-38 10-22 -25-34" fill="none" stroke="#E2C66B" stroke-width="2.5" stroke-dasharray="6 6" stroke-linecap="round"/>
    <line x1="175" y1="19" x2="175" y2="1.5" stroke="#3B2A00" stroke-width="2"/>
    <path d="M175 2.5h14l-4 4 4 4h-14z" fill="#FFC400" stroke="#3B2A00" stroke-width="1.2" stroke-linejoin="round"/>
  </svg>`);
}
