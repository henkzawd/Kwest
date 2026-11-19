// Kwest-logoen: et utropstegn i gull (oppdrag!) og et spørsmålstegn i gull for hvert spørsmål.
import { svg } from './util.js';

let n = 0;

// Metallisk gull: lyst øverst til venstre, mørkere nede, med en tynn kant i bronse.
function defs(id) {
  return `<defs>
    <linearGradient id="${id}g" x1="0" y1="0" x2=".55" y2="1">
      <stop offset="0" stop-color="#FBEBB5"/><stop offset=".28" stop-color="#E4BC5A"/>
      <stop offset=".55" stop-color="#C8962F"/><stop offset=".78" stop-color="#E2B755"/><stop offset="1" stop-color="#9C6C1C"/>
    </linearGradient>
    <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8C6420"/><stop offset="1" stop-color="#4A3410"/>
    </linearGradient>
  </defs>`;
}

export function exclamationSvg(size = 48) {
  const id = 'kw' + (n++);
  return svg(`<svg class="mark" width="${size * 0.64}" height="${size}" viewBox="0 0 64 100" aria-hidden="true">${defs(id)}
    <polygon points="18,8 46,8 38.5,63 25.5,63" fill="url(#${id}g)" stroke="url(#${id}b)" stroke-width="2.6" stroke-linejoin="round"/>
    <polygon points="22.5,11.5 30,11.5 28.4,57 27,57" fill="#FFF8DC" opacity=".55"/>
    <circle cx="32" cy="82" r="10" fill="url(#${id}g)" stroke="url(#${id}b)" stroke-width="2.6"/>
    <ellipse cx="29" cy="78.5" rx="3.6" ry="2.4" fill="#FFF8DC" opacity=".55"/>
  </svg>`);
}

export function questionSvg(size = 48) {
  const id = 'kw' + (n++);
  const d = 'M15 31 C15 10, 50 6, 50 29 C50 44, 32 45, 32 62';
  return svg(`<svg class="mark" width="${size * 0.64}" height="${size}" viewBox="0 0 64 100" aria-hidden="true">${defs(id)}
    <path d="${d}" fill="none" stroke="url(#${id}b)" stroke-width="17.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="url(#${id}g)" stroke-width="12.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M17.5 27 C19 15, 42 11, 46 24" fill="none" stroke="#FFF8DC" stroke-width="2.4" stroke-linecap="round" opacity=".6"/>
    <circle cx="32" cy="84" r="10" fill="url(#${id}g)" stroke="url(#${id}b)" stroke-width="2.6"/>
    <ellipse cx="29" cy="80.5" rx="3.6" ry="2.4" fill="#FFF8DC" opacity=".55"/>
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
  const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 100"><defs><linearGradient id="g" x1="0" y1="0" x2=".55" y2="1"><stop offset="0" stop-color="#FBEBB5"/><stop offset=".4" stop-color="#D9A940"/><stop offset="1" stop-color="#9C6C1C"/></linearGradient></defs><polygon points="17,7 47,7 39,64 25,64" fill="url(#g)" stroke="#5A3F12" stroke-width="4" stroke-linejoin="round"/><circle cx="32" cy="83" r="10.5" fill="url(#g)" stroke="#5A3F12" stroke-width="4"/></svg>`;
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
    <path d="M0 120V96c50-14 90-6 140-16s90-26 150-12 80 10 110 4v48z" fill="#F4EBD3"/>
    <path d="M20 120c40-18 90-14 120-28s30-26 60-38 10-22 -25-34" fill="none" stroke="#CDB27A" stroke-width="2.5" stroke-dasharray="6 6" stroke-linecap="round"/>
    <line x1="175" y1="19" x2="175" y2="1.5" stroke="#4A3410" stroke-width="2"/>
    <path d="M175 2.5h14l-4 4 4 4h-14z" fill="#D9A940" stroke="#4A3410" stroke-width="1.2" stroke-linejoin="round"/>
  </svg>`);
}
