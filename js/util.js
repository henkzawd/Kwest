// Små felles hjelpefunksjoner for alle sider.

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) sk.startsWith('--') ? el.style.setProperty(sk, sv) : (el.style[sk] = sv);
      }
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function svg(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild;
}

export function clear(el) { el.replaceChildren(); return el; }

export function uid(len = 12) {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return Array.from(a, b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
}

export function makePin() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(100000 + (a[0] % 900000));
}

export function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function qs(name) {
  return new URLSearchParams(location.search).get(name);
}

// Felles tekstnormalisering for kortsvar og ordsky.
export function normText(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFC')
    .replace(/[.,!?;:"'()\[\]{}«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

export function toast(msg, kind = '') {
  let box = document.querySelector('.toasts');
  if (!box) { box = h('div', { class: 'toasts' }); document.body.append(box); }
  const t = h('div', { class: 'toast ' + kind }, msg);
  box.append(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3100);
}

// Enkel dialogboks. Returnerer { el, close }.
export function modal(title, body, actions = []) {
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  const wrap = h('div', { class: 'modal-wrap', onclick: e => { if (e.target === wrap) close(); } },
    h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'modal-head' }, h('h2', null, title),
        h('button', { class: 'icon-btn', 'aria-label': 'Lukk', onclick: close }, '✕')),
      h('div', { class: 'modal-body' }, body),
      actions.length ? h('div', { class: 'modal-actions' }, actions) : null));
  document.body.append(wrap);
  document.addEventListener('keydown', onKey);
  return { el: wrap, close };
}

// Viser et bilde over hele skjermen (f.eks. et molekyl i forklaringen). Klikk eller Esc lukker.
export function zoomImage(src) {
  const close = () => { wrap.remove(); window.removeEventListener('keydown', onKey, true); };
  const onKey = e => { e.stopPropagation(); if (['Escape', 'Enter', ' '].includes(e.key)) { e.preventDefault(); close(); } };
  const wrap = h('div', { class: 'zoom-wrap', role: 'dialog', 'aria-modal': 'true', onclick: close }, h('img', { src, alt: '' }));
  document.body.append(wrap);
  window.addEventListener('keydown', onKey, true);
}

export function confirmBox(title, text, okLabel, cancelLabel) {
  return new Promise(resolve => {
    let m;
    const done = v => { m.close(); resolve(v); };
    m = modal(title, h('p', null, text), [
      h('button', { class: 'btn ghost', onclick: () => done(false) }, cancelLabel),
      h('button', { class: 'btn danger', onclick: () => done(true) }, okLabel),
    ]);
  });
}

// Skalerer ned bilder før lagring, slik at kwest ikke blir for tunge.
export function readImage(file, maxSide = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('not-image'));
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('bad-image'));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), hgt = Math.round(img.height * scale);
        const c = document.createElement('canvas');
        c.width = w; c.height = hgt;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, hgt);
        ctx.drawImage(img, 0, 0, w, hgt);
        const isPng = file.type === 'image/png' || file.type === 'image/gif';
        // PNG beholdes for grafikk med få farger, men bare hvis det ikke blir altfor stort.
        let url = isPng ? c.toDataURL('image/png') : '';
        if (!url || url.length > 600000) url = c.toDataURL('image/jpeg', quality);
        resolve(url);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function download(filename, text, type = 'application/json') {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: filename });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* ignorer */ }
    ta.remove();
    return ok;
  }
}

export function fmtDate(iso, lang) {
  try {
    return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-GB' : 'nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
}

// Adresse til elevsiden (samme mappe som denne siden).
export function baseUrl() {
  return location.origin + location.pathname.replace(/[^/]*$/, '');
}
