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

// Den hvite vimpelen på fjelltoppene (svalehale som vaier i vinden), med Kwests lille gule spørsmålstegn.
// Spørsmålstegnet bøyes etter bølgene i stoffet, og foldene skygger over det, så det ser trykt på ut.
// Vimpelen tegnes med stangfoten i (0, 0) og toppen ca. 105 enheter opp.
const CLOTH = 'M1.6 -97 C 14 -103, 28 -91, 42 -96 S 58 -101, 64 -97 L 53 -84 L 65 -70 C 52 -74, 38 -63, 24 -69 S 8 -73, 1.6 -70 Z';
const FOLDS = [[0, '#E9EDF2'], [.12, '#FFFFFF'], [.3, '#FFFFFF'], [.42, '#D9DFE7'], [.56, '#FFFFFF'], [.72, '#F4F6F9'], [.84, '#DCE2E9'], [1, '#F6F8FA']];

const bez = (a, b, c, d, t) => { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; };
// Kanten av stoffet som en liste punkter (x, y), fra venstre mot høyre.
function edge(segs) {
  const pts = [];
  for (const [p0, p1, p2, p3] of segs) for (let k = 0; k <= 24; k++) {
    const t = k / 24;
    pts.push([bez(p0[0], p1[0], p2[0], p3[0], t), bez(p0[1], p1[1], p2[1], p3[1], t)]);
  }
  return pts.sort((a, b) => a[0] - b[0]);
}
const TOP_EDGE = edge([[[1.6, -97], [14, -103], [28, -91], [42, -96]], [[42, -96], [56, -101], [58, -101], [64, -97]]]);
const BOTTOM_EDGE = edge([[[1.6, -70], [8, -73], [10, -75], [24, -69]], [[24, -69], [38, -63], [52, -74], [65, -70]]]);
const yAt = (pts, x) => {
  for (let i = 1; i < pts.length; i++) if (pts[i][0] >= x) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    return y0 + (y1 - y0) * ((x - x0) / Math.max(1e-6, x1 - x0));
  }
  return pts[pts.length - 1][1];
};
// Et punkt på et flatt flagg (høyde 27, fra y = -97 til -70) flyttes til samme sted på det bølgende stoffet.
// Stoffet bølger også innover: i folden (den mørke stripen) presses trykket litt sammen, og det løftes og senkes i takt med bølgen.
const warp = (x, y) => {
  const v = (y + 97) / 27, t = yAt(TOP_EDGE, x), b = yAt(BOTTOM_EDGE, x);
  const wave = Math.sin((2 * Math.PI * (x - 14)) / 26);
  return [x - 1.3 * wave, t + v * (b - t) + 1.1 * Math.cos((2 * Math.PI * (x - 14)) / 26)];
};

// Spørsmålstegnet (samme form som logoen), delt opp i små biter og bøyd etter stoffet.
const QM = [[[15, 30], [15, 10], [50, 6], [50, 29]], [[50, 29], [50, 44], [32, 44], [32, 60]]];
function split(seg, n) {
  const out = [];
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  let rest = seg;
  for (let k = n; k > 1; k--) {
    const t = 1 / k, [p0, p1, p2, p3] = rest;
    const a = lerp(p0, p1, t), b = lerp(p1, p2, t), c = lerp(p2, p3, t), d = lerp(a, b, t), e = lerp(b, c, t), f = lerp(d, e, t);
    out.push([p0, a, d, f]);
    rest = [f, e, c, p3];
  }
  out.push(rest);
  return out;
}
const QX = 26, QY = -83.5, QH = 18, QS = QH / 96; // midten og høyden på spørsmålstegnet på flagget
const onFlag = ([px, py]) => warp(QX + (px - 32) * QS, QY + (py - 48) * QS);
const f1 = n => n.toFixed(2);
const QPATH = QM.flatMap(seg => split(seg, 4)).map((seg, i) => {
  const [p0, p1, p2, p3] = seg.map(onFlag);
  return (i ? '' : `M${f1(p0[0])} ${f1(p0[1])}`) + ` C${f1(p1[0])} ${f1(p1[1])} ${f1(p2[0])} ${f1(p2[1])} ${f1(p3[0])} ${f1(p3[1])}`;
}).join('');
const QDOT = onFlag([32, 85]);

export function peakPennant(x, y, scale, id) {
  const w = 15 * QS;
  return `<defs>
      <linearGradient id="${id}f" x1="0" y1="0" x2="1" y2="0">${FOLDS.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>
      <linearGradient id="${id}v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#EDF0F4"/></linearGradient>
      <linearGradient id="${id}q" gradientUnits="userSpaceOnUse" x1="0" y1="${QY - 8}" x2="0" y2="${QY + 8}"><stop offset="0" stop-color="#FFD84A"/><stop offset=".55" stop-color="#FFB424"/><stop offset="1" stop-color="#FF8A1F"/></linearGradient>
      <linearGradient id="${id}p" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6E5A44"/><stop offset=".45" stop-color="#B49A78"/><stop offset="1" stop-color="#3E3022"/></linearGradient>
      <radialGradient id="${id}k" cx=".35" cy=".35" r=".7"><stop offset="0" stop-color="#FFF1B0"/><stop offset=".5" stop-color="#FFB424"/><stop offset="1" stop-color="#C9700F"/></radialGradient>
    </defs>
    <g transform="translate(${x} ${y}) scale(${scale})">
      <rect x="-1.6" y="-100" width="3.2" height="102" rx="1.4" fill="url(#${id}p)"/>
      <circle cx="0" cy="-102" r="3.4" fill="url(#${id}k)" stroke="#8A5410" stroke-width=".5"/>
      <path d="${CLOTH}" fill="#fff"/>
      <path d="${QPATH}" fill="none" stroke="#B8650E" stroke-width="${f1(w * 1.4)}" stroke-linecap="round" stroke-linejoin="round"/>
      <ellipse cx="${f1(QDOT[0])}" cy="${f1(QDOT[1])}" rx="${f1(13.2 * QS)}" ry="${f1(13.2 * QS)}" fill="#B8650E"/>
      <path d="${QPATH}" fill="none" stroke="url(#${id}q)" stroke-width="${f1(w)}" stroke-linecap="round" stroke-linejoin="round"/>
      <ellipse cx="${f1(QDOT[0])}" cy="${f1(QDOT[1])}" rx="${f1(10.2 * QS)}" ry="${f1(10.2 * QS)}" fill="#FF9A22"/>
      <path d="${CLOTH}" fill="url(#${id}f)" style="mix-blend-mode:multiply"/>
      <path d="${CLOTH}" fill="url(#${id}v)" style="mix-blend-mode:multiply"/>
      <path d="${CLOTH}" fill="none" stroke="#7F8B9C" stroke-width=".9" stroke-linejoin="round"/>
      <rect x="-2.4" y="-97" width="4.8" height="2.6" rx="1" fill="#3E3022"/><rect x="-2.4" y="-72" width="4.8" height="2.6" rx="1" fill="#3E3022"/>
    </g>`;
}
