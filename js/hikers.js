// Turgåerne på ventesiden: fem modeller, og en sjelden gang en fjellgeit.
// Figuren regnes ut fra elevens id, så mobilen og storskjermen alltid viser den samme – uten ekstra meldinger.
import { svg } from './util.js';
import { COLORS } from './game.js';

const INK = '#2E2A24';
const PACKS = [...COLORS, '#C88A12'];

const legs = `<path d="M21 34 L18 47 L14 61 M24 34 L27.5 47 L31 61" fill="none" stroke="${INK}" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/>`;
const torso = `<path d="M17.5 18 Q22.5 14.5 27 18 L27.4 34 Q22.5 37 17.2 34 Z" fill="${INK}"/>`;
const head = `<circle cx="22.6" cy="10" r="4.8" fill="${INK}"/>`;
const arm = d => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>`;

const FIGURES = [
  // Stavgåeren
  c => `<rect x="11" y="16" width="8" height="16" rx="3" fill="${c}"/>${arm('M19.5 20 L15.5 27 L12.5 30')}${legs}${torso}${head}${arm('M25 20 L29 27 L32.4 30.5')}
    <path d="M32.4 29 L36.4 62 M12.5 28.5 L9 62" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`,
  // Langturen
  c => `<rect x="8.5" y="8" width="10.5" height="26" rx="3.5" fill="${c}"/><rect x="7" y="3.5" width="13.5" height="5.2" rx="2.6" fill="#CDBB94" stroke="${INK}" stroke-width="1"/>${legs}${torso}${head}
    <path d="M18.4 7.4 Q22.6 1.2 26.8 7.4 Z" fill="${INK}"/><ellipse cx="22.6" cy="7.4" rx="7.4" ry="1.5" fill="${INK}"/>${arm('M25 20 L27.4 27.5 L25.6 32.5')}`,
  // Kartleseren
  c => `<rect x="12" y="18" width="7" height="12" rx="2.5" fill="${c}"/>${legs}${torso}${head}
    <path d="M17.8 9 Q22.6 2.6 27.4 9 Z" fill="${c}"/><path d="M26.4 8.6 L31.2 9.4" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/>
    ${arm('M20 21 L25 26 L28.6 26.5')}${arm('M25 20 L29 24.5 L31 25')}
    <rect x="28" y="19.5" width="12" height="9.5" rx="1" fill="#FFF4DC" stroke="${INK}" stroke-width="1.4"/><path d="M32 19.5v9.5M36 19.5v9.5" stroke="${INK}" stroke-width=".8"/>`,
  // Toppluen
  c => `<path d="M19.6 15.6 Q14 15.4 9.6 20" stroke="${c}" stroke-width="3.4" stroke-linecap="round" fill="none"/>${legs}${torso}${head}
    <path d="M17.6 9.6 Q22.6 1.2 27.6 9.6 Z" fill="${c}"/><circle cx="22.6" cy="2.6" r="2.5" fill="${c}"/>
    ${arm('M19.6 20 L18.2 29')}${arm('M25.4 20 L26.8 29')}`,
  // Hundeeieren
  c => `<rect x="12" y="17" width="7.5" height="14" rx="2.8" fill="${c}"/>${arm('M19.6 20 L16 28')}${legs}${torso}${head}${arm('M25 20 L29 27.5 L31 32.5')}
    <path d="M31 32.5 Q37 39 40.5 46.5" stroke="${INK}" stroke-width="1.1" fill="none"/>
    <path d="M37.6 53 v8 M44.4 53 v8" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/><ellipse cx="41" cy="51.5" rx="5.8" ry="3.2" fill="${INK}"/>
    <circle cx="46.6" cy="47.6" r="2.7" fill="${INK}"/><path d="M45.2 46 l-.6 -3 2 1.6z" fill="${INK}"/><path d="M35.6 50.4 l-2.6 -3.2" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`,
  // Fjellgeita
  () => {
    const W = '#FAF6EC';
    return `<path d="M14 45 L13 61 M18.5 47 L19 61 M27.5 47 L28.5 61 M31.5 45 L33 61" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M10.6 37.6 L7.4 34.6" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M29 37 Q33 31 35 26.5 L40 29.2 Q37.4 35 33.4 41 Z" fill="${W}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <ellipse cx="22" cy="40.5" rx="12.4" ry="7.6" fill="${W}" stroke="${INK}" stroke-width="2"/>
    <path d="M36 23.6 Q33.2 16.6 38.6 14.8" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" fill="none"/>
    <ellipse cx="39.4" cy="27" rx="5.2" ry="3.4" transform="rotate(28 39.4 27)" fill="${W}" stroke="${INK}" stroke-width="2"/>
    <path d="M41.6 30.6 L42.2 35.6 L39.6 32.2 Z" fill="${INK}"/><circle cx="40.2" cy="26" r=".9" fill="${INK}"/>`;
  },
];
export const GOAT = 5;

// Et lite, stabilt tall ut fra en tekst (samme svar hver gang).
export function hash(s) {
  let x = 2166136261;
  for (const ch of String(s)) { x ^= ch.codePointAt(0); x = Math.imul(x, 16777619); }
  return x >>> 0;
}

// Hvilken figur og sekkfarge eleven får. Omtrent én av femten blir geit.
export function hikerFor(id) {
  const n = hash(id);
  return { model: n % 15 === 0 ? GOAT : (n >>> 4) % 5, pack: PACKS[(n >>> 8) % PACKS.length] };
}

// color: lagfarge når lag er slått på, ellers elevens egen sekkfarge.
export function hikerSvg(id, color, size = 60) {
  const f = hikerFor(id);
  return svg(`<svg class="hiker" width="${Math.round(size * 52 / 64)}" height="${size}" viewBox="0 0 52 64" aria-hidden="true">${FIGURES[f.model](color || f.pack)}</svg>`);
}
