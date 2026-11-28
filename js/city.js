// Temaet «Metropolis»: Barcode i Bjørvika (Oslo) en vinterkveld, sett fra vannet.
// Elevene er pendlere (leder, konsulent, vintersyklist, løper, pendler med mobil) – og en sjelden gang en hvalross med slips.
// Poengtavlen er heiser opp skyskraperne, og pallen er de tre trappede tårnene i Barcode.
import { svg } from './util.js';
import { hash } from './hikers.js';

const INK = '#0F2A2D';
const LAMP = '#FFE3A0';
// Elevens egen farge (skjerf, lue, hjelm …) når lag ikke er slått på.
export const CITY_COLORS = ['#00A3A3', '#A5E1D2', '#F2B544', '#E2725B', '#7FB8E6', '#B98AD8'];

// Figurene tegnes i et rutenett på 48 × 72. c = elevens farge.
const FIGURES = {
  biz: c => `
    <path d="M20 52 L19.4 69 M28 52 L28.8 69" fill="none" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/>
    <path d="M15 24 Q24 19 33 24 L35 54 Q24 57.5 13 54 Z" fill="${INK}"/>
    <path d="M17.5 22 Q24 26.5 30.5 22 L30.5 26 Q24 29.5 17.5 26 Z" fill="${c}"/>
    <path d="M26.5 25 L30.5 37 L27.6 37.6 L24.8 26 Z" fill="${c}"/>
    <circle cx="24" cy="13.6" r="6" fill="${INK}"/>
    <path d="M33 26.5 L36.4 41" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>
    <path d="M34.6 41 L34.6 39.4 Q34.6 38 36 38 L38.6 38 Q40 38 40 39.4 L40 41" fill="none" stroke="${INK}" stroke-width="1.6"/>
    <rect x="31.5" y="41" width="11" height="8.4" rx="1.6" fill="${c}"/>`,
  consult: c => `
    <path d="M20.5 50 L20 69 M27.5 50 L28 69" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
    <path d="M16 24 Q24 19.5 32 24 L33.4 51 Q24 54 14.6 51 Z" fill="${INK}"/>
    <circle cx="24" cy="14.4" r="5.8" fill="${INK}"/>
    <path d="M18 12.6 Q24 3.4 30 12.6 Z" fill="${c}"/>
    <rect x="17.4" y="11.2" width="13.2" height="3.2" rx="1.6" fill="${c}"/>
    <path d="M17.4 26.5 L13.6 37.5" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M10.5 37 Q13.6 31 16.6 37" fill="none" stroke="${c}" stroke-width="1.6"/>
    <path d="M8 37 L19 37 L17.6 49.5 L9.4 49.5 Z" fill="${c}"/>
    <path d="M30.6 26.5 L34 35" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>
    <rect x="32" y="31.6" width="5.4" height="7.4" rx="1" fill="#F2FAF8"/>
    <rect x="32" y="33.6" width="5.4" height="2" fill="${c}"/>`,
  bike: c => `
    <circle cx="11.5" cy="60" r="8.6" fill="none" stroke="${INK}" stroke-width="2.6"/>
    <circle cx="37.5" cy="60" r="8.6" fill="none" stroke="${INK}" stroke-width="2.6"/>
    <circle cx="11.5" cy="60" r="10.2" fill="none" stroke="${INK}" stroke-width="1" stroke-dasharray="1 2.2"/>
    <circle cx="37.5" cy="60" r="10.2" fill="none" stroke="${INK}" stroke-width="1" stroke-dasharray="1 2.2"/>
    <path d="M11.5 60 L20 48.5 L32.5 48.5 L37.5 60 M20 48.5 L25 60 L11.5 60 M32.5 48.5 L30.6 42.4 L35.4 41.6" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="36.4" cy="44.4" r="1.7" fill="${LAMP}"/>
    <path d="M38 44.4 L47 42 L47 47.4 Z" fill="${LAMP}" opacity=".45"/>
    <path d="M18.6 46.5 L26.6 30.6" fill="none" stroke="${INK}" stroke-width="7.4" stroke-linecap="round"/>
    <path d="M26.6 32 L32.4 42" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M19.4 46 L26.4 51.4 L25.4 59.6" fill="none" stroke="${INK}" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M17.4 34 L23.4 30.6 L25.4 40.8 L19.4 43.6 Z" fill="${c}"/>
    <circle cx="30.4" cy="24.6" r="5.1" fill="${INK}"/>
    <path d="M25 24.2 Q29.6 15.6 36.2 22.4 Z" fill="${c}"/>`,
  runner: c => `
    <path d="M35 11.6 L48 8 L48 18 Z" fill="${LAMP}" opacity=".4"/>
    <path d="M22.6 40 L15.4 50 L10.6 57.6 M22.6 40 L29.4 52 L28.4 67" fill="none" stroke="${INK}" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M26 20.6 L22.6 40" fill="none" stroke="${INK}" stroke-width="7.4" stroke-linecap="round"/>
    <path d="M22 31 L27.4 28.6" fill="none" stroke="${c}" stroke-width="2"/>
    <path d="M25.2 23.6 L18 30.6 L20.4 36 M25.2 23.6 L31.6 29.4 L34 23.6" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="27.4" cy="13.4" r="5.4" fill="${INK}"/>
    <path d="M22 12.4 Q27.4 3.6 32.8 12.4 Z" fill="${c}"/>
    <circle cx="27.4" cy="5.6" r="2.1" fill="${c}"/>
    <circle cx="33" cy="12.6" r="1.6" fill="${LAMP}"/>`,
  phone: c => `
    <path d="M20 48 L20 69 M28 48 L28.4 69" fill="none" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/>
    <path d="M14.6 25 Q24 18.6 33.4 25 L33.8 48.6 Q24 51.6 14.2 48.6 Z" fill="${INK}"/>
    <path d="M14.8 31.6 Q24 34 33.4 31.6 M14.6 38.6 Q24 41 33.6 38.6 M14.4 45 Q24 47.4 33.8 45" fill="none" stroke="#2C4F52" stroke-width="1.2"/>
    <circle cx="24" cy="14" r="5.8" fill="${INK}"/>
    <path d="M17.6 14 Q18 5.4 24 5.4 Q30 5.4 30.4 14" fill="none" stroke="${c}" stroke-width="2.4"/>
    <rect x="15.8" y="11.6" width="3.6" height="6" rx="1.6" fill="${c}"/>
    <rect x="28.6" y="11.6" width="3.6" height="6" rx="1.6" fill="${c}"/>
    <path d="M31.6 28 L29.6 36 L25.6 35" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="21.8" y="31" width="4.4" height="6.6" rx="1" fill="#A5E1D2"/>`,
  walrus: c => `
    <path d="M7 70 Q3 46 15 34 Q24 28 33 34 Q45 46 41 70 Z" fill="#7A5646"/>
    <path d="M12 64 Q4 66 5 70 L17 70 Z M36 64 Q44 66 43 70 L31 70 Z" fill="#5E4136"/>
    <ellipse cx="24" cy="26" rx="12.5" ry="10.5" fill="#7A5646"/>
    <circle cx="19.2" cy="21.4" r="1.5" fill="${INK}"/>
    <circle cx="28.8" cy="21.4" r="1.5" fill="${INK}"/>
    <path d="M22 47 L24 45 L26 47 L25.2 60 L24 62 L22.8 60 Z" fill="${c}"/>
    <rect x="21.6" y="43.4" width="4.8" height="3.6" rx="1" fill="${c}"/>
    <path d="M19.6 34 L18.6 46 L21.4 46 L22 34 Z M28.4 34 L29.4 46 L26.6 46 L26 34 Z" fill="#F7F1E3"/>
    <circle cx="20" cy="30.6" r="5.6" fill="#C9A58A"/>
    <circle cx="28" cy="30.6" r="5.6" fill="#C9A58A"/>
    <circle cx="24" cy="26.8" r="1.6" fill="${INK}"/>
    <path d="M15.6 29.6 L11 28.4 M15.4 31.6 L10.6 31.8 M32.4 29.6 L37 28.4 M32.6 31.6 L37.4 31.8" fill="none" stroke="#5E4136" stroke-width=".9" stroke-linecap="round"/>`,
};
const KINDS = ['biz', 'consult', 'bike', 'runner', 'phone'];

// Hvilken figur og farge eleven får. Omtrent én av tjue blir hvalross.
export function citizenFor(id) {
  const n = hash(id);
  return { kind: n % 20 === 0 ? 'walrus' : KINDS[(n >>> 4) % KINDS.length], color: CITY_COLORS[(n >>> 8) % CITY_COLORS.length] };
}

// Figuren som tegning inni en annen SVG (brukes i heisene på pallen).
function citizenInner(id, color) {
  const f = citizenFor(id);
  return FIGURES[f.kind](color || f.color);
}

// color: lagfarge når lag er slått på, ellers elevens egen farge.
export function citizenSvg(id, color, size = 60) {
  const f = citizenFor(id);
  return svg(`<svg class="hiker citizen${f.kind === 'walrus' ? ' rare' : ''}" width="${Math.round(size * 48 / 72)}" height="${size}" viewBox="0 0 48 72" aria-hidden="true">${FIGURES[f.kind](color || f.color)}</svg>`);
}

// ---------- Mønstrene på fasadene ----------
// p = prefiks, så id-ene ikke kolliderer når flere scener står i samme dokument.
const patterns = p => `
  <pattern id="${p}LitBands" width="48" height="22" patternUnits="userSpaceOnUse"><rect width="48" height="15" fill="#F0D27E"/><rect y="15" width="48" height="7" fill="#20384A"/><rect width="2" height="15" fill="#B89F5A"/><rect x="26" width="22" height="15" fill="#D9BA68" opacity=".6"/></pattern>
  <pattern id="${p}White" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" fill="#E3EAEE"/><rect x="8" y="10" width="24" height="20" fill="#2B4C66"/><rect x="48" y="10" width="24" height="20" fill="${LAMP}"/><rect x="8" y="50" width="24" height="20" fill="${LAMP}"/><rect x="48" y="50" width="24" height="20" fill="#2B4C66"/></pattern>
  <pattern id="${p}Blue" width="72" height="44" patternUnits="userSpaceOnUse"><rect width="72" height="44" fill="#0E2A44"/><rect x="4" y="4" width="10" height="14" fill="#1F4A6E"/><rect x="22" y="4" width="10" height="14" fill="#1F4A6E"/><rect x="40" y="4" width="10" height="14" fill="${LAMP}"/><rect x="58" y="4" width="10" height="14" fill="#1F4A6E"/><rect x="4" y="26" width="10" height="14" fill="#1F4A6E"/><rect x="22" y="26" width="10" height="14" fill="#1F4A6E"/><rect x="40" y="26" width="10" height="14" fill="#1F4A6E"/><rect x="58" y="26" width="10" height="14" fill="${LAMP}" opacity=".7"/></pattern>
  <pattern id="${p}Tri" width="32" height="32" patternUnits="userSpaceOnUse"><rect width="32" height="32" fill="#E8EEF0"/><path d="M0 0 L16 16 L0 32 Z" fill="#FFF1C8"/><path d="M32 0 L16 16 L32 32 Z" fill="#CFDAE0"/><path d="M0 0 L32 0 L16 16 Z" fill="#F7FAFB"/></pattern>
  <pattern id="${p}Stripes" width="136" height="56" patternUnits="userSpaceOnUse"><rect width="136" height="56" fill="#0A1622"/><rect y="4" width="136" height="6" fill="#1E3448"/><rect x="10" y="17" width="50" height="7" fill="${LAMP}"/><rect y="31" width="136" height="6" fill="#1E3448"/><rect x="74" y="44" width="40" height="7" fill="${LAMP}"/><rect x="0" y="44" width="18" height="7" fill="${LAMP}" opacity=".7"/></pattern>
  <pattern id="${p}ResBrown" width="40" height="36" patternUnits="userSpaceOnUse"><rect width="40" height="36" fill="#3A2420"/><rect x="5" y="8" width="12" height="14" fill="#241512"/><rect x="23" y="8" width="12" height="14" fill="#FFD98A" opacity=".8"/></pattern>
  <pattern id="${p}Glass" width="48" height="42" patternUnits="userSpaceOnUse"><rect width="48" height="32" fill="#F3DD95"/><rect x="24" width="24" height="32" fill="#E1C57A"/><rect y="32" width="48" height="10" fill="#22384A"/><rect width="2" height="32" fill="#B89F5A"/></pattern>
  <pattern id="${p}Grey" width="120" height="92" patternUnits="userSpaceOnUse"><rect width="120" height="92" fill="#474C55"/><rect x="10" y="10" width="20" height="26" fill="${LAMP}"/><rect x="50" y="10" width="20" height="26" fill="#2B3A4A"/><rect x="90" y="10" width="20" height="26" fill="${LAMP}"/><rect x="10" y="56" width="20" height="26" fill="#2B3A4A"/><rect x="50" y="56" width="20" height="26" fill="${LAMP}"/><rect x="90" y="56" width="20" height="26" fill="${LAMP}"/></pattern>
  <pattern id="${p}Fins" width="12" height="60" patternUnits="userSpaceOnUse"><rect width="12" height="60" fill="#F5E7B8"/><rect width="4" height="60" fill="#FFFFFF"/></pattern>
  <pattern id="${p}Brown" width="60" height="40" patternUnits="userSpaceOnUse"><rect width="60" height="40" fill="#4A2C26"/><rect x="6" y="8" width="20" height="16" fill="#2A1A17"/><rect x="34" y="8" width="20" height="16" fill="#FFD98A"/></pattern>`;

const SNOW = '#F4FAF9';

// De tre trappede tårnene (tegnet i egne rutenett, så de kan brukes både i silhuetten og på pallen).
// Glasstårnet med skrå stålramme: 260 × 400, taket der heisen stopper er y = 22.
const towerGlass = p => `
  <rect x="0" y="22" width="192" height="378" fill="url(#${p}Glass)"/>
  <rect x="0" y="22" width="192" height="40" fill="#1E3442" opacity=".7"/>
  <rect x="140" y="0" width="44" height="24" fill="#2A3F4E"/>
  <path d="M192 22 L192 400 L238 400 Z" fill="#12283A"/>
  <path d="M192 22 L212 22 L260 400 L238 400 Z" fill="#1E4E8C"/>
  <path d="M194 44 L215 44 M197 74 L219 74 M201 104 L222 104 M205 134 L226 134 M208 164 L230 164 M212 194 L234 194 M216 224 L238 224 M219 254 L242 254 M223 284 L245 284 M227 314 L249 314 M230 344 L253 344 M234 374 L257 374" stroke="#5B95D6" stroke-width="3"/>
  <rect x="-2" y="18" width="196" height="7" rx="3" fill="${SNOW}"/><rect x="138" y="-3" width="48" height="6" rx="3" fill="${SNOW}"/>`;
// Det grå, trappede tårnet: 300 × 480, øverste tak er y = 8 (x 130–196).
const towerStepped = p => `
  <path d="M0 480 L0 230 L24 230 L24 150 L48 150 L48 110 L70 110 L70 50 L92 50 L92 20 L130 20 L130 8 L196 8 L196 30 L240 30 L240 70 L262 70 L262 120 L278 120 L278 170 L300 170 L300 480 Z" fill="url(#${p}Grey)"/>
  <rect x="72" y="150" width="188" height="52" fill="url(#${p}Fins)"/>
  <rect x="30" y="440" width="240" height="40" fill="#F3DD95" opacity=".9"/>
  <g fill="${SNOW}"><rect x="128" y="4" width="70" height="6" rx="3"/><rect x="90" y="16" width="42" height="6" rx="3"/><rect x="194" y="26" width="48" height="6" rx="3"/><rect x="68" y="46" width="26" height="6" rx="3"/><rect x="238" y="66" width="26" height="6" rx="3"/><rect x="46" y="106" width="26" height="6" rx="3"/><rect x="260" y="116" width="20" height="6" rx="3"/><rect x="22" y="146" width="28" height="6" rx="3"/><rect x="276" y="166" width="26" height="6" rx="3"/><rect x="-2" y="226" width="28" height="6" rx="3"/></g>`;
const antenna = '<path d="M163 8 L163 -30" stroke="#2A2F38" stroke-width="3"/><circle cx="163" cy="-31" r="3.5" fill="#FF6B5A"/>';
// Terrassebygget med den hvite blokka foran: 300 × 330, øverste tak er y = 6 (x 136–268).
const towerTerrace = p => `
  <path d="M10 330 L10 140 L34 140 L34 110 L58 110 L58 82 L84 82 L84 56 L110 56 L110 30 L136 30 L136 6 L268 6 L268 330 Z" fill="url(#${p}Brown)"/>
  <path d="M10 140 L34 140 L34 110 L58 110 L58 82 L84 82 L84 56 L110 56 L110 30 L136 30 L136 6" fill="none" stroke="#EDEAE3" stroke-width="6"/>
  <rect x="40" y="132" width="260" height="198" fill="url(#${p}White)"/>
  <g fill="${SNOW}"><rect x="134" y="2" width="136" height="7" rx="3"/><rect x="38" y="128" width="264" height="7" rx="3"/></g>`;

// Hele rekka slik den ser ut fra vannet (koordinater fra bildet: bredde 1920, bakkenivå y = 772).
const skyline = p => `
  <path d="M680 680 Q800 575 960 586 Q1110 570 1240 600 Q1320 615 1390 680 Z" fill="#082638"/>
  <path d="M0 772 L0 640 L60 640 L60 772 Z M1866 772 L1866 580 L1920 580 L1920 772 Z" fill="#0E2A44"/>
  <rect x="1728" y="384" width="139" height="388" fill="url(#${p}ResBrown)"/>
  <rect x="62" y="451" width="185" height="321" fill="url(#${p}LitBands)"/>
  <rect x="196" y="451" width="51" height="321" fill="#20384A" opacity=".35"/>
  <rect x="284" y="470" width="92" height="302" fill="url(#${p}White)"/>
  <rect x="269" y="384" width="110" height="86" fill="url(#${p}White)"/>
  <rect x="269" y="466" width="110" height="6" fill="#B7C6CE"/>
  <rect x="221" y="552" width="139" height="220" fill="url(#${p}White)"/>
  <rect x="518" y="528" width="36" height="244" fill="#0E2A44"/>
  <rect x="374" y="340" width="144" height="432" fill="url(#${p}Blue)"/>
  <path d="M562 772 L562 478 L596 478 L600 404 L706 412 L710 772 Z" fill="url(#${p}Tri)"/>
  <path d="M600 404 L706 412 L700 432 L604 426 Z" fill="#0E1E2C"/>
  <rect x="826" y="337" width="129" height="435" fill="url(#${p}Stripes)"/>
  <rect x="1008" y="441" width="67" height="331" fill="url(#${p}White)"/>
  <rect x="975" y="724" width="235" height="48" fill="#8FA3B3"/>
  <g transform="translate(1123 446) scale(.57 .815)">${towerGlass(p)}</g>
  <g transform="translate(1291 364) scale(.863 .85)">${towerStepped(p)}${antenna}</g>
  <g transform="translate(1546 422) scale(.793 1.06)">${towerTerrace(p)}</g>
  <g fill="${SNOW}"><rect x="60" y="447" width="189" height="6" rx="3"/><rect x="267" y="380" width="114" height="6" rx="3"/><rect x="372" y="336" width="148" height="6" rx="3"/><rect x="824" y="333" width="133" height="6" rx="3"/><rect x="1006" y="437" width="71" height="6" rx="3"/><rect x="1726" y="380" width="143" height="6" rx="3"/></g>`;

const aurora = (id, y = 0) => `
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#A5E1D2" stop-opacity="0"/><stop offset=".3" stop-color="#7FE3C4" stop-opacity=".45"/><stop offset=".7" stop-color="#A5E1D2" stop-opacity=".3"/><stop offset="1" stop-color="#A5E1D2" stop-opacity="0"/></linearGradient>
  <filter id="${id}f" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="16"/></filter></defs>
  <path class="aurora" d="M-40 ${150 + y} C 280 60, 600 200, 900 110 S 1400 60, 1640 140 L1640 200 C 1400 130, 1150 220, 900 170 S 280 160, -40 220 Z" fill="url(#${id})" filter="url(#${id}f)"/>`;

const stars = () => {
  let s = '';
  for (let i = 0; i < 30; i++) s += `<circle class="star" cx="${(i * 337) % 1600}" cy="${12 + ((i * 131) % 180)}" r="${0.8 + (i % 3) * 0.5}" style="animation-delay:${(i % 7) * 0.45}s"/>`;
  return s;
};

// Venterommet: rekka over vannet, med en snødekt brygge i forgrunnen der elevene står.
export function cityLobbyScene() {
  return svg(`<svg class="scene" viewBox="0 0 1600 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="clSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#021826"/><stop offset=".5" stop-color="#063550"/><stop offset=".85" stop-color="#0B5068"/><stop offset="1" stop-color="#1C6E80"/></linearGradient>
      <linearGradient id="clWater" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0A3A50"/><stop offset="1" stop-color="#031620"/></linearGradient>
      <linearGradient id="clPier" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F4FAF9"/><stop offset="1" stop-color="#C9DEDB"/></linearGradient>
      <filter id="clStreak" x="-5%" y="-5%" width="110%" height="140%"><feGaussianBlur stdDeviation="1.4 10"/></filter>
      <clipPath id="clWaterClip"><rect x="0" y="420" width="1600" height="62"/></clipPath>
      ${patterns('cl')}
    </defs>
    <rect width="1600" height="420" fill="url(#clSky)"/>
    ${aurora('clAur')}
    <g>${stars()}</g>
    <g fill="#0A2E44" opacity=".8"><rect x="0" y="330" width="70" height="90"/><rect x="80" y="300" width="50" height="120"/><rect x="140" y="345" width="90" height="75"/><rect x="240" y="315" width="60" height="105"/><rect x="310" y="350" width="80" height="70"/><rect x="400" y="320" width="70" height="100"/></g>
    <g id="clSkyline" transform="translate(482 -51) scale(.61)">${skyline('cl')}</g>
    <rect x="0" y="420" width="1600" height="280" fill="url(#clWater)"/>
    <g clip-path="url(#clWaterClip)" opacity=".5" filter="url(#clStreak)"><use href="#clSkyline" transform="translate(0 840) scale(1 -1)"/></g>
    <rect x="0" y="416" width="1600" height="5" fill="${SNOW}"/>
    <path d="M0 486 Q800 472 1600 486 L1600 700 L0 700 Z" fill="url(#clPier)"/>
    <path d="M0 486 Q800 472 1600 486" fill="none" stroke="#fff" stroke-width="4"/>
    <g stroke="${INK}" stroke-width="4" stroke-linecap="round"><path d="M560 484 L560 458 M1560 484 L1560 458"/></g>
    <path d="M560 460 Q1060 448 1560 460" fill="none" stroke="${INK}" stroke-width="3"/>
    <g><path d="M1580 484 L1580 430" stroke="${INK}" stroke-width="5"/><path d="M1580 432 Q1580 420 1568 420 L1562 420" fill="none" stroke="${INK}" stroke-width="4"/>
    <circle cx="1560" cy="426" r="7" fill="${LAMP}"/><circle cx="1560" cy="426" r="30" fill="${LAMP}" opacity=".18"/></g>
  </svg>`);
}

// Bakgrunnen bak heisene på poengtavlen: kveldshimmel, nordlys og disige bygg langt bak.
export function cityBoardBackdrop() {
  let far = '';
  const W = [120, 90, 160, 70, 140, 100, 180, 80, 150, 110, 130, 90, 170, 100];
  let x = 0;
  W.forEach((w, i) => { const hh = 220 + ((i * 97) % 220); far += `<rect x="${x}" y="${700 - hh}" width="${w}" height="${hh}"/>`; x += w + 14; });
  return svg(`<svg class="scene" viewBox="0 0 1600 700" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="cbSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#021826"/><stop offset=".5" stop-color="#063550"/><stop offset=".85" stop-color="#0B5068"/><stop offset="1" stop-color="#1C6E80"/></linearGradient></defs>
    <rect width="1600" height="700" fill="url(#cbSky)"/>
    ${aurora('cbAur', -40)}
    <g>${stars()}</g>
    <g fill="#0A2E44" opacity=".7">${far}</g>
  </svg>`);
}

// Fasadene på heistårnene (CSS-bakgrunner).
export const CITY_FACADES = [
  'background-color:#E3EAEE;background-image:repeating-linear-gradient(0deg,#E3EAEE 0 8px,transparent 8px 24px),repeating-linear-gradient(90deg,#E3EAEE 0 6px,#2B4C66 6px 18px)',
  'background-color:#0A1622;background-image:repeating-linear-gradient(0deg,#0A1622 0 10px,#1E3448 10px 16px,#0A1622 16px 26px,rgba(255,227,160,.85) 26px 32px)',
  'background-color:#0E2A44;background-image:repeating-linear-gradient(0deg,#0E2A44 0 6px,transparent 6px 20px),repeating-linear-gradient(90deg,#0E2A44 0 6px,#1F4A6E 6px 16px)',
  'background-color:#F3DD95;background-image:repeating-linear-gradient(0deg,#22384A 0 8px,#F3DD95 8px 38px),repeating-linear-gradient(90deg,rgba(184,159,90,.8) 0 2px,transparent 2px 34px)',
  'background-color:#474C55;background-image:repeating-linear-gradient(0deg,#474C55 0 10px,transparent 10px 34px),repeating-linear-gradient(90deg,#474C55 0 10px,#FFE3A0 10px 26px)',
  'background-color:#3A2420;background-image:repeating-linear-gradient(0deg,#3A2420 0 8px,transparent 8px 26px),repeating-linear-gradient(90deg,#3A2420 0 6px,#241512 6px 18px)',
];

// Pallen: de tre trappede tårnene i Barcode, med vinnernes heiser på taket.
// Plasseringene (i scenen på 1600 × 700) brukes også til navnelappene.
const S = 0.7; // tårnene skaleres ned så navnene får plass over
export const PODIUM_SPOTS = {
  2: { tx: 470, ty: 640 - 400 * S, carX: 20, roof: 22, h: 400, metal: '#D6E2E4', num: [96, 200] },
  1: { tx: 695, ty: 640 - 480 * S, carX: 109, roof: 8, h: 480, metal: '#F2C14E', num: [165, 320] },
  3: { tx: 935, ty: 640 - 330 * S, carX: 148, roof: 6, h: 330, metal: '#D08A5A', num: [170, 260] },
};
// Hvor navnelappen skal stå (prosent av scenen): midt over heisen.
export function podiumLabelAt(place) {
  const s = PODIUM_SPOTS[place];
  return { left: ((s.tx + (s.carX + 54) * S) / 16) + '%', top: ((s.ty + (s.roof - 158) * S) / 7) + '%' };
}
const RISE = { 1: 1.8, 2: 1.0, 3: 0.3 };

// winners: { 1: { id, color }, 2: …, 3: … } – den som mangler får ingen heis.
export function cityPodiumScene(winners) {
  const burst = (x, y, r, c, d) => `<g class="fw" style="animation-delay:${d}s"><g transform="translate(${x} ${y})" stroke="${c}" stroke-width="4" stroke-linecap="round">
    <path d="M0 -${r * .4} L0 -${r} M${r * .28} -${r * .28} L${r * .7} -${r * .7} M${r * .4} 0 L${r} 0 M${r * .28} ${r * .28} L${r * .7} ${r * .7} M0 ${r * .4} L0 ${r} M-${r * .28} ${r * .28} L-${r * .7} ${r * .7} M-${r * .4} 0 L-${r} 0 M-${r * .28} -${r * .28} L-${r * .7} -${r * .7}"/></g></g>`;
  const building = place => {
    const s = PODIUM_SPOTS[place];
    const body = place === 1 ? towerStepped('cp') + antenna : place === 2 ? towerGlass('cp') : towerTerrace('cp');
    const w = winners[place];
    const car = w ? `<g class="lift" style="--from:${s.h - s.roof}px;animation-delay:${RISE[place]}s">
        <rect x="${s.carX + 4}" y="${s.roof - 4}" width="100" height="5" rx="2.5" fill="${s.metal}" class="roof-glow" style="animation-delay:${RISE[place] + 2.2}s"/>
        <rect x="${s.carX}" y="${s.roof - 150}" width="108" height="150" rx="10" fill="#FFE9B0" stroke="#0A1622" stroke-width="5"/>
        <svg x="${s.carX + 12}" y="${s.roof - 134}" width="84" height="126" viewBox="0 0 48 72">${citizenInner(w.id, w.color)}</svg>
      </g>` : '';
    return `<g transform="translate(${s.tx} ${s.ty}) scale(${S})">${body}
      <text x="${s.num[0]}" y="${s.num[1]}" class="tower-num" fill="${s.metal}">${place}</text>${car}</g>`;
  };
  return svg(`<svg class="scene" viewBox="0 0 1600 700" aria-hidden="true">
    <defs>
      <linearGradient id="cpSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#020F18"/><stop offset=".55" stop-color="#04263A"/><stop offset=".85" stop-color="#08425A"/><stop offset="1" stop-color="#155E72"/></linearGradient>
      ${patterns('cp')}
    </defs>
    <rect width="1600" height="700" fill="url(#cpSky)"/>
    ${aurora('cpAur', -30)}
    <g>${stars()}</g>
    ${burst(260, 230, 80, '#F2C14E', 0)}${burst(1360, 200, 70, '#A5E1D2', 1.1)}${burst(1180, 110, 46, '#FFFFFF', 1.9)}${burst(430, 110, 46, '#7DB7F0', 0.6)}
    <g fill="#06263A"><rect x="30" y="420" width="120" height="220"/><rect x="160" y="370" width="70" height="270"/><rect x="240" y="330" width="110" height="310"/><rect x="360" y="400" width="100" height="240"/>
      <rect x="1180" y="420" width="110" height="220"/><rect x="1300" y="350" width="110" height="290"/><rect x="1420" y="440" width="70" height="200"/><rect x="1500" y="380" width="100" height="260"/></g>
    <g fill="${LAMP}" opacity=".5"><rect x="58" y="460" width="12" height="8"/><rect x="110" y="540" width="12" height="8"/><rect x="190" y="410" width="10" height="8"/><rect x="280" y="380" width="14" height="8"/><rect x="300" y="520" width="14" height="8"/><rect x="390" y="450" width="12" height="8"/><rect x="1210" y="470" width="12" height="8"/><rect x="1340" y="400" width="14" height="8"/><rect x="1370" y="560" width="12" height="8"/><rect x="1530" y="430" width="12" height="8"/></g>
    <rect x="0" y="640" width="1600" height="60" fill="#031620"/>
    <g opacity=".55"><rect x="490" y="652" width="150" height="5" fill="#F3DD95"/><rect x="720" y="652" width="170" height="5" fill="${LAMP}"/><rect x="760" y="670" width="100" height="4" fill="${LAMP}"/><rect x="960" y="652" width="160" height="5" fill="#E3EAEE"/></g>
    <rect x="0" y="636" width="1600" height="6" fill="${SNOW}"/>
    ${building(1)}${building(2)}${building(3)}
  </svg>`);
}
