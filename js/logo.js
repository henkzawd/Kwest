// Kwest-logoen: et gult utropstegn (oppdrag!) og et gult spørsmålstegn for hvert spørsmål.
import { svg } from './util.js';

let n = 0;

// Myk gul → oransje, uten kant – egne tegninger i Kwest-stil.
const TOP = '#FFE14D', MID = '#FFBC2A', BOTTOM = '#FF8A1F';

export function exclamationSvg(size = 48) {
  const id = 'kw' + (n++);
  return svg(`<svg class="mark" width="${size * 0.64}" height="${size}" viewBox="0 0 64 100" aria-hidden="true"><defs>
    <linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${TOP}"/><stop offset=".5" stop-color="${MID}"/><stop offset="1" stop-color="${BOTTOM}"/></linearGradient>
    <linearGradient id="${id}d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD23F"/><stop offset="1" stop-color="${BOTTOM}"/></linearGradient></defs>
    <path d="M20 12 Q32 2 44 12 L38.5 62 Q32 68 25.5 62 Z" fill="url(#${id}a)" stroke="url(#${id}a)" stroke-width="5" stroke-linejoin="round"/>
    <circle cx="32" cy="85" r="10.5" fill="url(#${id}d)"/>
  </svg>`);
}

export function questionSvg(size = 48) {
  const id = 'kw' + (n++);
  return svg(`<svg class="mark" width="${size * 0.64}" height="${size}" viewBox="0 0 64 100" aria-hidden="true"><defs>
    <linearGradient id="${id}a" gradientUnits="userSpaceOnUse" x1="0" y1="6" x2="0" y2="66"><stop offset="0" stop-color="${TOP}"/><stop offset=".55" stop-color="#FFB424"/><stop offset="1" stop-color="${BOTTOM}"/></linearGradient>
    <linearGradient id="${id}d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD23F"/><stop offset="1" stop-color="${BOTTOM}"/></linearGradient></defs>
    <path d="M15 30 C15 10, 50 6, 50 29 C50 44, 32 44, 32 60" fill="none" stroke="url(#${id}a)" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="32" cy="85" r="10.5" fill="url(#${id}d)"/>
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
  const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 100"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE14D"/><stop offset=".5" stop-color="#FFBC2A"/><stop offset="1" stop-color="#FF8A1F"/></linearGradient></defs><path d="M20 12 Q32 2 44 12 L38.5 62 Q32 68 25.5 62 Z" fill="url(#g)" stroke="url(#g)" stroke-width="5" stroke-linejoin="round"/><circle cx="32" cy="85" r="10.5" fill="#FF9F25"/></svg>`;
  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = 'data:image/svg+xml,' + encodeURIComponent(s);
  document.head.append(link);
}

// Et rolig landskap med sti opp til et lite spørsmålstegn på toppen – bakgrunn på elevsiden.
export function landscape() {
  return svg(`<svg viewBox="0 0 400 120" preserveAspectRatio="xMidYMax slice" width="100%" height="100%">
    <path d="M0 120V78l60-30 45 22 70-52 55 38 40-20 60 34 70-26v76z" fill="#F7F3E6"/>
    <path d="M175 18l-14 10 8 2-9 9 15-6 10 6z" fill="#fff" opacity=".9"/>
    <path d="M0 120V96c50-14 90-6 140-16s90-26 150-12 80 10 110 4v48z" fill="#FFF3D6"/>
    <path d="M20 120c40-18 90-14 120-28s30-26 60-38 10-22 -25-34" fill="none" stroke="#F2C46B" stroke-width="2.5" stroke-dasharray="6 6" stroke-linecap="round"/>
    <defs><linearGradient id="lq" gradientUnits="userSpaceOnUse" x1="0" y1="6" x2="0" y2="66"><stop offset="0" stop-color="#FFE14D"/><stop offset="1" stop-color="#FF8A1F"/></linearGradient></defs>
    <g transform="translate(169.6 0.5) scale(0.17)">
      <path d="M15 30 C15 10, 50 6, 50 29 C50 44, 32 44, 32 60" fill="none" stroke="url(#lq)" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="32" cy="85" r="10.5" fill="#FF9A22"/>
    </g>
  </svg>`);
}
