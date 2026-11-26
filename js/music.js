// Bakgrunnsmusikk og lydeffekter for storskjermen. Alt lages i nettleseren med Web Audio – ingen lydfiler.
// Instrumenter: bambusfløyte, klimpret streng (guzheng-aktig), rammetromme, klokker/syngeskål og en dyp bordun.
// Stemninger: «lobby» (tempelporten), «question» (klatringen, raskere når tiden renner ut),
// «calm» (fasit/diskusjon), «scoreboard» (leirbålet) og «podium» (toppen).
import { h } from './util.js';
import { t } from './i18n.js';
import { icon } from './icons.js';

// ---------- Noter ----------
const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midi = n => { const m = /^([A-G])(#|b)?(\d)$/.exec(n); return 12 * (+m[3] + 1) + STEP[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };
const hz = m => 440 * 2 ** ((m - 69) / 12);
const f = n => hz(midi(n));
const MINOR = [0, 3, 5, 7, 10]; // D F G A C – tempelet
const D3 = 50, D4 = 62;
const deg = (root, d) => hz(root + 12 * Math.floor(d / 5) + MINOR[((d % 5) + 5) % 5]); // trinn i pentatonen
const rnd = () => Math.random();
const pick = a => a[Math.floor(rnd() * a.length)];
// [note, åttedeler] – «r» er pause
const seq = s => s.trim().split(/\s+/).map(x => { const [n, l] = x.split(':'); return [n, +l]; });

// ---------- Lydmotoren (brukes både live og til forhåndsvisning) ----------
export function createEngine(ac, { cleanup = true, soundtrack = 'whiteTiger' } = {}) {
  const E = {};
  const gain = (v = 1) => { const g = ac.createGain(); g.gain.value = v; return g; };
  const vol = gain(0.16);
  const soft = ac.createBiquadFilter(); soft.type = 'lowpass'; soft.frequency.value = 8500;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.3;
  vol.connect(soft); soft.connect(comp); comp.connect(ac.destination);
  const music = gain(); music.connect(vol); // dukkes når spørsmålet har egen lyd
  const verb = ac.createConvolver(); verb.buffer = impulse(ac, 3.4);
  const verbOut = gain(0.7); verb.connect(verbOut); verbOut.connect(music);
  const fx = { dry: gain(), wet: verb }; fx.dry.connect(vol);

  const noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; }
  const wave = (amps) => ac.createPeriodicWave(new Float32Array(amps.length), new Float32Array(amps));
  const FLUTE = wave([0, 1, 0.3, 0.12, 0.05, 0.025, 0.01]);
  const PLUCK = wave([0, ...Array.from({ length: 14 }, (_, i) => (i % 2 ? 0.7 : 1) / (i + 1) ** 1.35)]);

  function out(o, level, wet) {
    const g = gain(level);
    g.connect(o.dry);
    if (wet) { const s = gain(wet); g.connect(s); s.connect(o.wet); }
    return g;
  }
  function osc(type, fq, t, end) {
    const o = ac.createOscillator();
    if (type.constructor === String) o.type = type; else o.setPeriodicWave(type);
    o.frequency.setValueAtTime(fq, t);
    o.start(t); o.stop(end);
    return o;
  }
  function noiseSrc(t, end) {
    const n = ac.createBufferSource(); n.buffer = noise; n.loop = true;
    n.start(t, rnd() * 1.5); n.stop(end);
    return n;
  }
  function filter(type, fq, q = 0.7) { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = fq; b.Q.value = q; return b; }

  // Bambusfløyte: myk tone med pust, lite «chiff» i starten og vibrato som kommer etter hvert.
  E.flute = (o, t, fq, dur, vel = 0.6) => {
    const end = t + dur + 0.7, att = Math.min(0.09, dur * 0.5), rel = t + Math.max(att, dur);
    const g = out(o, 0.25, 0.55);
    const a = gain(0);
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(vel, t + att);
    a.gain.linearRampToValueAtTime(vel * 0.82, rel); a.gain.setTargetAtTime(0, rel, 0.08);
    const o1 = osc(FLUTE, fq * 0.985, t, end);
    o1.frequency.exponentialRampToValueAtTime(fq, t + 0.06);
    const lfo = osc('sine', 4.6 + rnd() * 0.8, t, end), depth = gain(0);
    const vs = t + Math.min(0.35, dur * 0.45);
    depth.gain.setValueAtTime(0, vs); depth.gain.linearRampToValueAtTime(16, vs + 0.45);
    lfo.connect(depth); depth.connect(o1.detune);
    o1.connect(a); a.connect(g);
    const n = noiseSrc(t, end), bp = filter('bandpass', Math.min(fq * 2.5, 5000), 0.9), ng = gain(0);
    ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(vel * 0.5, t + 0.03);
    ng.gain.setTargetAtTime(vel * 0.09, t + 0.035, 0.07); ng.gain.setTargetAtTime(0, rel, 0.06);
    n.connect(bp); bp.connect(ng); ng.connect(g);
  };
  // Klimpret streng.
  E.pluck = (o, t, fq, vel = 0.4, decay = 1.6) => {
    const g = out(o, 0.38, 0.35);
    const lp = filter('lowpass', Math.min(fq * 9, 7000), 0.8);
    lp.frequency.setValueAtTime(Math.min(fq * 9, 7000), t);
    lp.frequency.setTargetAtTime(fq * 1.6, t + 0.005, 0.12);
    const a = gain(0);
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(vel, t + 0.004);
    a.gain.setTargetAtTime(0, t + 0.005, decay / 4.6);
    osc(PLUCK, fq, t, t + decay + 0.1).connect(lp); lp.connect(a); a.connect(g);
  };
  // Rammetromme / dyp tempeltromme.
  E.drum = (o, t, vel = 0.4, f0 = 70) => {
    const g = out(o, 0.6, 0.18);
    const o1 = osc('sine', f0 * 1.9, t, t + 0.9);
    o1.frequency.exponentialRampToValueAtTime(f0, t + 0.09);
    const a = gain(0);
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(vel, t + 0.004); a.gain.setTargetAtTime(0, t + 0.006, 0.13);
    o1.connect(a); a.connect(g);
    const n = noiseSrc(t, t + 0.2), lp = filter('lowpass', 700), ng = gain(0);
    ng.gain.setValueAtTime(vel * 0.35, t); ng.gain.setTargetAtTime(0, t + 0.002, 0.025);
    n.connect(lp); lp.connect(ng); ng.connect(g);
  };
  // Trekloss (nedtelling).
  E.wood = (o, t, vel = 0.3, fq = 1300) => {
    const g = out(o, 1, 0.2), a = gain(0);
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(vel, t + 0.002); a.gain.setTargetAtTime(0, t + 0.003, 0.03);
    osc('sine', fq, t, t + 0.3).connect(a);
    const b = gain(0.35); osc('sine', fq * 2.71, t, t + 0.3).connect(b); b.connect(a);
    a.connect(g);
  };
  E.shaker = (o, t, vel = 0.15) => {
    const g = out(o, 0.6, 0.1), hp = filter('highpass', 6500), a = gain(0);
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(vel, t + 0.012); a.gain.setTargetAtTime(0, t + 0.014, 0.03);
    noiseSrc(t, t + 0.25).connect(hp); hp.connect(a); a.connect(g);
  };
  // Klokke / vindspill.
  E.bell = (o, t, fq, vel = 0.2, decay = 3) => {
    const g = out(o, 0.5, 0.6);
    [[1, 1, 1], [2.76, 0.4, 0.6], [5.4, 0.18, 0.3], [8.93, 0.08, 0.15]].forEach(([r, v, d]) => {
      const a = gain(0), end = t + decay * d;
      a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(vel * v, t + 0.003); a.gain.setTargetAtTime(0, t + 0.004, decay * d / 4.6);
      osc('sine', fq * r, t, end + 0.1).connect(a); a.connect(g);
    });
  };
  E.chimes = (o, t, vel = 0.12) => {
    const n = 2 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) E.bell(o, t + i * (0.07 + rnd() * 0.08), deg(D4, 10 + Math.floor(rnd() * 6)), vel * (1 - i * 0.15), 2.4);
  };
  // Syngeskål: lange, svevende deltoner.
  E.bowl = (o, t, fq, vel = 0.4) => {
    const g = out(o, 1, 0.5);
    [[1, 1, 5], [2.71, 0.45, 3.2], [5.15, 0.15, 1.6]].forEach(([r, v, d]) => [0, 1.3].forEach(dt => {
      const a = gain(0);
      a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(vel * v * 0.5, t + 0.01); a.gain.setTargetAtTime(0, t + 0.012, d / 4.6);
      osc('sine', fq * r + dt, t, t + d + 0.1).connect(a); a.connect(g);
    }));
  };
  // Horn til fanfaren.
  E.horn = (o, t, fq, dur, vel = 0.3) => {
    const g = out(o, 0.22, 0.5), lp = filter('lowpass', fq, 1.2), a = gain(0), rel = t + dur;
    lp.frequency.setValueAtTime(fq * 1.2, t); lp.frequency.linearRampToValueAtTime(fq * 4, t + 0.12); lp.frequency.setTargetAtTime(fq * 2.4, t + 0.13, 0.3);
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(vel, t + 0.07); a.gain.setTargetAtTime(vel * 0.7, t + 0.1, 0.4); a.gain.setTargetAtTime(0, rel, 0.12);
    [-6, 6].forEach(c => { const x = osc('sawtooth', fq, t, rel + 0.8); x.detune.value = c; x.connect(lp); });
    lp.connect(a); a.connect(g);
  };
  // Strykere: akkord som sveller inn (seksjon av lett forstemte sagtann-bølger med vibrato).
  E.strings = (o, t, freqs, dur, vel = 0.15, att = 0.4) => {
    const g = out(o, 0.17, 0.5), lp = filter('lowpass', 2200, 0.5), a = gain(0), rel = t + Math.max(dur, att), end = rel + 1.5;
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(vel, t + att); a.gain.setTargetAtTime(0, rel, 0.25);
    const lfo = osc('sine', 5.2, t, end), lg = gain(7); lfo.connect(lg);
    freqs.forEach(fq => [-9, 9].forEach(c => { const x = osc('sawtooth', fq, t, end); x.detune.value = c; lg.connect(x.detune); x.connect(lp); }));
    lp.connect(a); a.connect(g);
  };
  // Fiolin/stryker-melodi: myk start og vibrato som kommer etter hvert.
  E.violin = (o, t, fq, dur, vel = 0.4) => {
    const att = Math.min(0.12, dur * 0.5), rel = t + Math.max(att, dur), end = rel + 0.8;
    const g = out(o, 0.2, 0.55), lp = filter('lowpass', Math.min(fq * 5, 6000), 0.6), hp = filter('highpass', 200), a = gain(0);
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(vel, t + att); a.gain.linearRampToValueAtTime(vel * 0.85, rel); a.gain.setTargetAtTime(0, rel, 0.12);
    const lfo = osc('sine', 5.5, t, end), depth = gain(0), vs = t + Math.min(0.25, dur * 0.4);
    depth.gain.setValueAtTime(0, vs); depth.gain.linearRampToValueAtTime(18, vs + 0.4); lfo.connect(depth);
    [-6, 0, 6].forEach(c => { const x = osc('sawtooth', fq, t, end); x.detune.value = c; depth.connect(x.detune); x.connect(lp); });
    lp.connect(hp); hp.connect(a); a.connect(g);
  };
  // Pauker.
  E.timpani = (o, t, fq, vel = 0.4) => {
    const g = out(o, 0.5, 0.3);
    [[1, 1, 1.4], [1.5, 0.45, 0.9], [2, 0.25, 0.5]].forEach(([r, v, d]) => {
      const x = osc('sine', fq * r * 1.04, t, t + d + 0.2), a = gain(0);
      x.frequency.exponentialRampToValueAtTime(fq * r, t + 0.06);
      a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(vel * v, t + 0.005); a.gain.setTargetAtTime(0, t + 0.006, d / 4.6);
      x.connect(a); a.connect(g);
    });
    const n = noiseSrc(t, t + 0.15), lp = filter('lowpass', 900), ng = gain(0);
    ng.gain.setValueAtTime(vel * 0.25, t); ng.gain.setTargetAtTime(0, t + 0.002, 0.02);
    n.connect(lp); lp.connect(ng); ng.connect(g);
  };
  E.fx = fx;
  // Dyp bordun som ligger under alt; åpner seg (lysere) når spenningen stiger.
  E.drone = (o, t, freqs, vel = 0.4) => {
    const g = out(o, 0.125, 0.4), lp = filter('lowpass', 320, 0.6), a = gain(0);
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(vel, t + 3);
    const lfo = osc('sine', 0.07, t, t + 3600), lg = gain(90); lfo.connect(lg); lg.connect(lp.frequency);
    const oscs = [lfo];
    freqs.forEach(fq => [-7, 7].forEach(c => { const x = osc('sawtooth', fq, t, t + 3600); x.detune.value = c; x.connect(lp); oscs.push(x); }));
    lp.connect(a); a.connect(g);
    return {
      stop(at) { oscs.forEach(x => { try { x.stop(at); } catch { /* allerede stoppet */ } }); },
      bright(fq, at) { lp.frequency.setTargetAtTime(fq, at, 0.6); },
    };
  };

  let SCENES = {};

  // ---------- Effekter ----------
  let joinAt = 0, joinN = 0;
  const SFX = {
    join(at) { // en elev kom inn: små toner som klatrer oppover
      if (at - joinAt < 0.12) return;
      joinN = at - joinAt > 3 ? 0 : joinN + 1; joinAt = at;
      E.pluck(fx, at, deg(D4, 5 + (joinN % 8)), 0.32, 0.9);
    },
    go(at) { E.bowl(fx, at, f('D5'), 0.35); }, // spørsmålet starter
    tick(at, o) { E.wood(fx, at, 0.28, o?.last ? 1700 : 1300); }, // siste sekunder
    reveal(at) { // fasit
      E.bowl(fx, at, f('D4'), 0.45);
      ['D5', 'F5', 'A5', 'D6'].forEach((x, i) => E.pluck(fx, at + 0.08 * i, f(x), 0.3, 1.6));
    },
  };

  // ---------- Avspilling ----------
  const FADE = 1.4;
  let cur = null;
  const gone = []; // utfasede stemninger kobles fra når etterklangen har dødd ut
  const retire = (old, at, tau = FADE / 3) => {
    [old.out.dry.gain, old.out.wet.gain].forEach(p => {
      if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(at); else p.cancelScheduledValues(at);
      p.setTargetAtTime(0, at, tau);
    });
    old.drone?.stop(at + tau * 3 + 0.2);
    if (cleanup) gone.push([at + tau * 3 + 4, old.out]);
  };
  // «end»: spørsmålsmusikken spiller litt over et sekund til i samme tempo, avslutter med et slag, og så blir det stille.
  E.setScene = (name, opts = {}, at = ac.currentTime) => {
    if (cur && cur.name === name) { Object.assign(cur.opts, opts); return; }
    if (name === 'end' && cur?.def.outro) { cur.name = 'end'; cur.endAt = at + 1.1; return; }
    if (cur) retire(cur, at);
    cur = null;
    const def = SCENES[name];
    if (!def) return;
    const dry = gain(0), wet = gain(0);
    dry.connect(music); wet.connect(verb);
    const fadeIn = name === 'podium' ? 0.05 : 1.2;
    [dry.gain, wet.gain].forEach(p => { p.setValueAtTime(0, at); p.linearRampToValueAtTime(1, at + fadeIn); });
    const s = { name, def, opts: { ...opts }, out: { dry, wet }, n: 0, t: at + 0.05, q: new Map() };
    s.at = (n, fn) => { if (!s.q.has(n)) s.q.set(n, []); s.q.get(n).push(fn); };
    def.setup(s, s.t);
    cur = s;
  };
  // Bytt lydspor: det som spiller tones ut, og neste skjerm bruker det nye.
  E.useSoundtrack = id => { SCENES = (SOUNDTRACKS[id] || SOUNDTRACKS.whiteTiger)(E); if (cur) { retire(cur, ac.currentTime); cur = null; } };
  E.tension = p => { if (cur?.name === 'question') cur.opts.p = p; };
  E.pump = (until, now = until - 1) => {
    while (gone.length && gone[0][0] < now) { const o = gone.shift()[1]; o.dry.disconnect(); o.wet.disconnect(); }
    const s = cur;
    if (!s) return;
    if (s.t < now) s.t = now + 0.05; // fanen har sovet: hopp over i stedet for å spille alt på en gang
    while (s.t < until) {
      const sd = 30 / s.def.bpm(s);
      if (s.endAt && s.t >= s.endAt && s.n % 2 === 0) { s.def.outro(s, s.t); retire(s, s.t + 0.3, 0.35); cur = null; return; }
      (s.q.get(s.n) || []).forEach(fn => fn(s.t, sd));
      s.q.delete(s.n);
      s.def.step(s, s.n, s.t, sd);
      s.n++; s.t += sd;
    }
  };
  E.sfx = (name, opts, at = ac.currentTime + 0.02) => (SCENES.sfx?.[name] || SFX[name])?.(at, opts); // lydsporet kan ha egne effekter
  E.duck = on => music.gain.setTargetAtTime(on ? 0 : 1, ac.currentTime, on ? 0.12 : 0.6);
  E.volume = v => vol.gain.setTargetAtTime(v * v, ac.currentTime, 0.05);
  E.scene = () => cur?.name || null;
  E.useSoundtrack(soundtrack);
  return E;
}

// ---------- Lydspor ----------
// Hvert lydspor lager sine egne stemninger (lobby, question, calm, scoreboard, podium) av instrumentene i motoren.
// Nye lydspor legges til her og i SOUNDTRACKS i game.js (og får et navn i i18n.js).
const SOUNDTRACKS = {
  whiteTiger, // Tempelet til den hvite tigeren: bambusfløyte, klimpret streng, tempeltromme og vindspill i D-moll-pentaton
  jotunheimen, // Jotunheimen: strykere, horn, harpe og pauker i romantisk, Grieg-aktig stil
  none: () => ({}), // ingen musikk, bare lydeffekter
};

function whiteTiger(E) {
// ---------- Stemningene ----------
const flutePhrase = (s, n, notes, vel) => {
  let pos = n;
  notes.forEach(([d, len]) => {
    if (d !== null) {
      const fq = typeof d === 'string' ? f(d) : deg(D4, d), v = vel * (0.9 + rnd() * 0.2), grace = len >= 3 && rnd() < 0.3;
      s.at(pos, (t, sd) => {
        if (grace) E.flute(s.out, t - 0.075, fq * 2 ** (2 / 12), 0.06, v * 0.7);
        E.flute(s.out, t, fq, len * sd * 0.94, v);
      });
    }
    pos += len;
  });
  return pos;
};
const melody = (s, n, list, vel) => flutePhrase(s, n, list.map(([x, l]) => [x === 'r' ? null : x, l]), vel);

const LOBBY_PHRASES = [ // trinn i D-moll-pentatonen (0 = D4), lengde i åttedeler
  [[3, 2], [5, 2], [4, 1], [3, 1], [2, 2], [3, 6]],
  [[5, 3], [6, 1], [7, 2], [6, 1], [5, 1], [4, 2], [5, 6]],
  [[2, 2], [3, 1], [4, 1], [3, 4], [1, 2], [0, 6]],
  [[7, 4], [8, 2], [7, 1], [6, 1], [5, 2], [3, 2], [5, 8]],
  [[3, 1], [4, 1], [5, 2], [4, 2], [3, 2], [2, 2], [3, 2], [1, 4], [2, 6]],
  [[5, 2], [3, 2], [4, 3], [5, 1], [2, 8]],
];
const ARP = [0, 7, 12, 7, 0, 7, 12, 7];
const CAMP = seq(`A4:2 C5:2 D5:3 C5:1 A4:2 G4:2 F4:4 G4:2 A4:2 C5:2 D5:1 F5:1 D5:6 r:2
  F5:2 D5:2 C5:3 A4:1 C5:2 D5:2 A4:4 G4:2 A4:1 G4:1 F4:2 D4:2 F4:6 r:2`);
const SUMMIT = seq(`F#5:2 A5:2 B5:2 A5:2 F#5:3 E5:1 D5:4 E5:2 F#5:2 A5:2 E5:2 D5:2 B4:2 A4:4
  B4:2 D5:2 E5:3 F#5:1 A5:4 F#5:2 E5:2 D5:2 E5:1 D5:1 B4:2 A4:2 D5:8`);
const OSTINATO = [[-5, 0, -2, 0, -5, 1, -2, 0], [-6, -1, -3, -1, -6, 0, -3, -1], [-5, 0, -2, 0, -5, 1, -2, 0], [-4, 1, -2, 1, -4, 2, -1, 1]];

return {
  // Tempelporten: bordun, rolig klimpring, fløytefraser som kommer og går, vindspill.
  lobby: {
    bpm: () => 66,
    setup(s, t) { s.drone = E.drone(s.out, t, [f('D2'), f('A2')], 0.5); s.next = 12; s.order = []; },
    step(s, n, t) {
      const k = n % 8, root = [0, -1, 1, -3][(n >> 3) % 4];
      if (k === 0) E.pluck(s.out, t, deg(D3, root), 0.5, 2.4);
      if (k === 3 && rnd() < 0.75) E.pluck(s.out, t, deg(D3, root + 3), 0.32, 2);
      if (k === 5 && rnd() < 0.5) E.pluck(s.out, t, deg(D3, root + 5), 0.26, 2);
      if (k === 6 && rnd() < 0.3) E.pluck(s.out, t, deg(D3, root + 4), 0.2, 2);
      if (k === 0 && (n >> 3) % 2 === 0) E.drum(s.out, t, 0.32, 60);
      if (rnd() < 0.03) E.chimes(s.out, t, 0.1);
      if (n >= s.next) {
        if (!s.order.length) s.order = [0, 1, 2, 3, 4, 5].sort(() => rnd() - 0.5);
        s.next = flutePhrase(s, n, LOBBY_PHRASES[s.order.pop()], 0.55) + 6 + Math.floor(rnd() * 10);
      }
    },
  },
  // Klatringen: jevn klimprefigur og tromme. Tempo og lag øker når tiden renner ut (opts.p 0→1).
  question: {
    bpm: s => 86 + 40 * (s.opts.pre ? 0 : s.opts.p || 0) ** 1.4,
    setup(s, t) { s.drone = E.drone(s.out, t, [f('D2'), f('A2')], 0.4); },
    step(s, n, t) {
      const pre = s.opts.pre, p = pre ? 0 : Math.min(1, s.opts.p || 0), k = n % 8;
      const d = OSTINATO[(n >> 3) % 4][k];
      E.pluck(s.out, t, deg(D4, d), (k === 0 ? 0.5 : k % 2 ? 0.28 : 0.38) * (pre ? 0.75 : 1) * (1 + p * 0.3), 1.1);
      if (pre) return;
      if (p > 0.6 && k % 2 === 0) E.pluck(s.out, t, deg(D4, d + 5), 0.16 + p * 0.1, 0.7);
      const hits = p < 0.5 ? [0, 5] : p < 0.8 ? [0, 4, 5] : [0, 2, 4, 6, 7];
      if (hits.includes(k)) E.drum(s.out, t, (k === 0 ? 0.48 : 0.32) * (1 + p * 0.3), 66);
      if (p >= 0.35 && (k % 2 || p >= 0.7)) E.shaker(s.out, t, 0.1 + 0.2 * p);
      if (k === 0) s.drone.bright(320 + 900 * p, t);
      if (n % 32 === 16) flutePhrase(s, n, p < 0.7 ? [[3, 6], [2, 2], [3, 8]] : [[5, 3], [6, 1], [5, 4]], 0.4);
    },
    outro(s, t) { // siste slag når fasiten vises
      E.drum(s.out, t, 0.65, 58);
      [[D3 - 12, 0.4], [D3, 0.45], [D3 + 7, 0.35], [D4, 0.3]].forEach(([m, v]) => E.pluck(s.out, t, hz(m), v, 1.6));
    },
  },
  // Fasit og diskusjon: bare bordun og spredte toner.
  calm: {
    bpm: () => 60,
    setup(s, t) { s.drone = E.drone(s.out, t, [f('D2'), f('A2')], 0.35); },
    step(s, n, t) {
      const k = n % 8, root = [0, -1][(n >> 3) % 2];
      if (k === 0) E.pluck(s.out, t, deg(D3, root), 0.34, 2.6);
      if ((k === 3 || k === 6) && rnd() < 0.45) E.pluck(s.out, t, deg(D4, Math.floor(rnd() * 6)), 0.2, 2.2);
      if (rnd() < 0.02) E.chimes(s.out, t, 0.08);
    },
  },
  // Leirbålet: lysere (F-dur-pentaton), galopperende tromme og en fløytemelodi.
  scoreboard: {
    bpm: () => 92,
    setup(s) { s.next = 8; s.cycle = 0; },
    step(s, n, t) {
      const k = n % 8, root = ['F3', 'D3', 'G3', 'D3', 'F3', 'D3', 'C3', 'F3'][(n >> 3) % 8];
      E.pluck(s.out, t, hz(midi(root) + ARP[k]), k === 0 ? 0.42 : 0.26, 1.2);
      if (k === 0 || k === 3 || k === 4) E.drum(s.out, t, k === 0 ? 0.42 : 0.26, 72);
      if (k % 2) E.shaker(s.out, t, 0.1);
      if (n === s.next) {
        if (s.cycle < 2 || s.cycle % 2 === 0) melody(s, n, CAMP, 0.55);
        s.cycle++; s.next += 64;
      }
    },
  },
  // Toppen: trommevirvel mens fjellene reiser seg, fanfare når gullet er på plass, så en rolig seiersmelodi.
  podium: {
    bpm: () => 84,
    setup(s, t) {
      for (let x = 0.15; x < 2.75; x += 0.055) E.drum(s.out, t + x, 0.06 + 0.32 * (x / 2.75) ** 1.5, (x * 18) % 2 < 1 ? 74 : 82);
      s.drone = E.drone(s.out, t + 2.8, [f('D2'), f('A2')], 0.35);
      s.next = 32; s.cycle = 0;
    },
    step(s, n, t, sd) {
      if (n === 4) melody(s, n, seq('A4:1 D5:1 E5:1 F#5:1 A5:5 F#5:1 E5:1 F#5:1 D5:8'), 0.7);
      if (n === 8) {
        E.drum(s.out, t, 0.7, 60); E.bell(s.out, t, f('D6'), 0.25, 4);
        ['D3', 'A3', 'D4', 'F#4'].forEach(x => E.horn(s.out, t, f(x), sd * 8, 0.3));
      }
      if (n === 16) { E.drum(s.out, t, 0.5, 64); ['G2', 'D3', 'B3'].forEach(x => E.horn(s.out, t, f(x), sd * 4, 0.26)); }
      if (n === 20) { E.drum(s.out, t, 0.45, 64); ['A2', 'E3', 'C#4'].forEach(x => E.horn(s.out, t, f(x), sd * 4, 0.26)); }
      if (n === 24) { E.drum(s.out, t, 0.55, 60); ['D3', 'A3', 'D4'].forEach(x => E.horn(s.out, t, f(x), sd * 8, 0.24)); E.chimes(s.out, t, 0.12); }
      if (n < 32) return;
      const k = n % 8, root = ['D3', 'D3', 'A2', 'G2', 'G2', 'D3', 'A2', 'D3'][((n - 32) >> 3) % 8];
      E.pluck(s.out, t, hz(midi(root) + ARP[k]), k === 0 ? 0.36 : 0.22, 1.4);
      if (k === 0) E.drum(s.out, t, 0.3, 64);
      if (k === 4) E.drum(s.out, t, 0.18, 70);
      if (rnd() < 0.025) E.chimes(s.out, t, 0.1);
      if (n === s.next) {
        if (s.cycle < 2 || s.cycle % 2 === 0) melody(s, n, SUMMIT, 0.5);
        s.cycle++; s.next += 64;
      }
    },
  },
};
}

function jotunheimen(E) {
  const ch = str => str.split(' ').map(midi);
  const F = m => hz(m);
  // Spiller en melodi med valgt instrument; shift flytter den i halvtoner.
  const line = (s, n, list, play, vel, shift = 0) => {
    let pos = n;
    list.forEach(([x, l]) => {
      if (x !== 'r') { const fq = F(midi(x) + shift); s.at(pos, (t, sd) => play(s.out, t, fq, l * sd * 0.95, vel * (0.92 + rnd() * 0.16))); }
      pos += l;
    });
    return pos;
  };
  const violin = (o, t, fq, d, v) => E.violin(o, t, fq, d, v);
  const horn = (o, t, fq, d, v) => E.horn(o, t, fq, d, v);
  const flute = (o, t, fq, d, v) => E.flute(o, t, fq, d, v);
  const harp = (o, t, m, v = 0.24) => E.pluck(o, t, F(m), v, 2.6);
  const pizz = (o, t, m, v = 0.3) => E.pluck(o, t, F(m), v, 0.45);

  // Morgen over vidda (6/8): harpe, strykerakkorder og en melodi som går på omgang mellom fiolin, horn og fløyte.
  const DAWN_CH = ['E2 B2 E3 G#3 B3', 'C#3 G#3 C#4 E4', 'A2 E3 A3 C#4 E4', 'A2 E3 A3 C4 E4', 'G#2 E3 G#3 B3 E4', 'F#2 F#3 A3 C#4 E4', 'B2 F#3 A3 B3 D#4', 'E2 B2 E3 G#3 B3'].map(ch);
  const DAWN = seq(`G#4:2 B4:1 E5:3 D#5:1 E5:1 C#5:1 B4:3 A4:2 C#5:1 E5:3 E5:2 D5:1 C5:3
    B4:2 G#4:1 E4:3 F#4:1 G#4:1 A4:1 C#5:3 B4:3 A4:1 G#4:1 F#4:1 E4:6`);
  // Klatringen (e-moll): pizzicato som går fortere, pauker og hornrop.
  const CLIMB = [['E3', 'B3', 'G3', 'B3', 'E3', 'B3', 'G3', 'B3'], ['E3', 'B3', 'G3', 'B3', 'E3', 'C4', 'G3', 'B3'],
    ['C3', 'G3', 'E3', 'G3', 'C3', 'G3', 'E3', 'G3'], ['B2', 'F#3', 'D#3', 'F#3', 'B2', 'A3', 'F#3', 'D#3']].map(b => b.map(midi));
  const CLIMB_CH = ['E3 B3 G4', 'E3 B3 G4', 'C3 G3 E4', 'B2 F#3 D#4 A4'].map(ch);
  // Leirplassen (G-dur): spenstig pizzicato og en folketoneaktig melodi.
  const CAMP_CH = ['G2 D3 G3 B3', 'F#2 D3 A3 D4', 'E2 B2 G3 B3', 'C3 G3 C4 E4', 'G2 D3 G3 B3', 'A2 E3 A3 C4', 'D3 A3 D4 F#4', 'G2 D3 G3 B3'].map(ch);
  const CAMP = seq(`G4:2 B4:2 D5:3 B4:1 A4:2 F#4:2 D4:4 E4:2 G4:2 B4:2 A4:1 G4:1 E4:6 r:2
    D5:2 B4:2 G4:3 B4:1 A4:2 C5:2 E5:4 D5:2 C5:1 B4:1 A4:2 F#4:2 G4:6 r:2`);
  // Toppen (D-dur): fanfare og en bred hymne.
  const HYMN_CH = ['D3 A3 D4 F#4', 'B2 F#3 B3 D4', 'G2 D3 G3 B3', 'A2 E3 A3 C#4', 'F#2 D3 A3 D4', 'G2 D3 B3 E4', 'A2 E3 G3 C#4', 'D3 A3 D4 F#4'].map(ch);
  const HYMN = seq(`F#5:4 E5:2 D5:2 D5:3 C#5:1 B4:4 B4:2 D5:2 G5:3 F#5:1 E5:8
    F#5:3 E5:1 D5:2 A4:2 B4:2 D5:2 G5:4 F#5:2 E5:2 D5:2 C#5:2 D5:8`);
  const ARP6 = [1, 2, 3, 4, 3, 2];

  let joinAt = 0, joinN = 0;
  const JOIN = ch('E5 F#5 G#5 B5 C#6 E6 F#6 G#6');
  return {
    lobby: {
      bpm: () => 69,
      setup(s) { s.cycle = 0; },
      step(s, n, t, sd) {
        const k = n % 6, bar = Math.floor(n / 6), c = DAWN_CH[bar < 2 ? 0 : (bar - 2) % 8];
        if (k === 0) { E.strings(s.out, t, c.map(F), sd * 6, 0.13, 0.8); if (bar % 4 === 0) E.timpani(s.out, t, F(40), 0.22); }
        harp(s.out, t, c[ARP6[k] % c.length] + 12, k === 0 ? 0.26 : 0.18);
        if (bar >= 2 && (bar - 2) % 8 === 0 && k === 0) {
          const lead = [[violin, 0, 0.42], [horn, -12, 0.3], null, [flute, 12, 0.45], null][s.cycle++ % 5];
          if (lead) line(s, n, DAWN, lead[0], lead[2], lead[1]);
        }
      },
    },
    question: {
      bpm: s => 84 + 42 * (s.opts.pre ? 0 : s.opts.p || 0) ** 1.4,
      setup() {},
      step(s, n, t, sd) {
        const pre = s.opts.pre, p = pre ? 0 : Math.min(1, s.opts.p || 0), k = n % 8, b = (n >> 3) % 4;
        const m = CLIMB[b][k];
        pizz(s.out, t, m, (k === 0 ? 0.42 : k % 2 ? 0.24 : 0.32) * (pre ? 0.75 : 1) * (1 + p * 0.3));
        if (k === 0) E.strings(s.out, t, CLIMB_CH[b].map(F), sd * 8, 0.08 + p * 0.08, 0.5);
        if (pre) return;
        if (p > 0.6 && k % 2 === 0) pizz(s.out, t, m + 12, 0.14 + p * 0.1);
        const hits = p < 0.5 ? [0] : p < 0.8 ? [0, 4] : [0, 2, 4, 6, 7];
        if (hits.includes(k)) E.timpani(s.out, t, F(b === 3 ? 35 : 40), (k === 0 ? 0.42 : 0.28) * (1 + p * 0.3));
        if (n % 32 === 16) line(s, n, p < 0.7 ? seq('B3:3 E4:5') : seq('E4:2 G4:2 B4:4'), horn, 0.28);
      },
      outro(s, t) { // siste slag når fasiten vises
        E.timpani(s.out, t, F(40), 0.6);
        E.strings(s.out, t, ch('E2 E3 B3 E4 G4').map(F), 0.35, 0.22, 0.02);
      },
    },
    calm: {
      bpm: () => 54,
      setup() {},
      step(s, n, t, sd) {
        const k = n % 8, c = ['E3 B3 E4 G#4', 'A2 E3 A3 C#4 E4', 'C#3 G#3 C#4 E4', 'B2 F#3 B3 D#4'].map(ch)[(n >> 4) % 4];
        if (n % 16 === 0) E.strings(s.out, t, c.map(F), sd * 16, 0.1, 1.5);
        if ((k === 3 || k === 6) && rnd() < 0.4) harp(s.out, t, c[1 + Math.floor(rnd() * (c.length - 1))] + 12, 0.16);
      },
    },
    scoreboard: {
      bpm: () => 96,
      setup(s) { s.next = 8; s.cycle = 0; },
      step(s, n, t, sd) {
        const k = n % 8, bar = n >> 3, c = CAMP_CH[bar < 1 ? 0 : (bar - 1) % 8];
        pizz(s.out, t, k === 0 ? c[0] : c[[0, 2, 1, 3, 0, 2, 1, 3][k]] + 12, k === 0 ? 0.4 : 0.24);
        if (k === 0) { E.strings(s.out, t, c.slice(1).map(F), sd * 8, 0.08, 0.3); E.timpani(s.out, t, F(c[0] < 43 ? c[0] + 12 : c[0]), 0.28); }
        if (k === 4) E.timpani(s.out, t, F(38), 0.16);
        if (n === s.next) {
          if (s.cycle < 2 || s.cycle % 2 === 0) line(s, n, CAMP, s.cycle % 2 ? violin : horn, s.cycle % 2 ? 0.4 : 0.3);
          s.cycle++; s.next += 64;
        }
      },
    },
    podium: {
      bpm: () => 84,
      setup(s, t) {
        for (let x = 0.15; x < 2.75; x += 0.06) E.timpani(s.out, t + x, F(38), 0.05 + 0.3 * (x / 2.75) ** 1.5);
        E.strings(s.out, t, ch('A2 E3 A3 C#4').map(F), 2.8, 0.12, 2.6);
        s.next = 32; s.cycle = 0;
      },
      step(s, n, t, sd) {
        if (n === 4) line(s, n, seq('A3:1 D4:1 F#4:1 A4:1'), horn, 0.34);
        if (n === 8) line(s, n, seq('D5:5 C#5:1 B4:1 C#5:1 D5:4 E5:4 F#5:8'), violin, 0.45);
        const fan = { 8: ['D3 A3 D4 F#4 A4', 'D4 F#4 A4', 38, 8], 16: ['G2 D3 B3 G4', 'G3 B3 D4', 0, 4], 20: ['A2 E3 C#4 A4', 'A3 C#4 E4', 33, 4], 24: ['D3 A3 D4 F#4', 'D4 F#4 A4', 38, 8] }[n];
        if (fan) {
          E.strings(s.out, t, ch(fan[0]).map(F), sd * fan[3], 0.16, 0.05);
          ch(fan[1]).forEach(m => E.horn(s.out, t, F(m), sd * fan[3], 0.24));
          if (fan[2]) E.timpani(s.out, t, F(fan[2]), n === 8 ? 0.7 : 0.5);
          if (n === 8) E.bell(s.out, t, F(86), 0.22, 4);
        }
        if (n < 32) return;
        const k = n % 8, c = HYMN_CH[((n - 32) >> 3) % 8];
        if (k === 0) { E.strings(s.out, t, c.map(F), sd * 8, 0.12, 0.6); E.timpani(s.out, t, F(c[0] < 43 ? c[0] + 12 : c[0]), 0.22); pizz(s.out, t, c[0], 0.32); }
        harp(s.out, t, c[[1, 2, 3, 2, 1, 2, 3, 2][k]] + 12, 0.16);
        if (n === s.next) {
          if (s.cycle < 2 || s.cycle % 2 === 0) line(s, n, HYMN, s.cycle % 2 ? horn : violin, s.cycle % 2 ? 0.3 : 0.42, s.cycle % 2 ? -12 : 0);
          s.cycle++; s.next += 64;
        }
      },
    },
    // Egne lydeffekter: harpe og klokkespill i stedet for tempelklokker.
    sfx: {
      join(at) {
        if (at - joinAt < 0.12) return;
        joinN = at - joinAt > 3 ? 0 : joinN + 1; joinAt = at;
        harp(E.fx, at, JOIN[joinN % JOIN.length], 0.3);
      },
      go(at) { E.bell(E.fx, at, F(76), 0.3, 3); E.strings(E.fx, at, ch('E3 B3 E4').map(F), 1.2, 0.08, 0.5); },
      reveal(at) {
        E.bell(E.fx, at, F(88), 0.25, 3.5);
        ch('E5 G#5 B5 E6').forEach((m, i) => harp(E.fx, at + 0.08 * i, m, 0.3));
      },
    },
  };
}

function impulse(ac, sec) { // etterklang som i en steinhall
  const sr = ac.sampleRate, len = Math.floor(sr * sec), b = ac.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const x = i / sr;
      lp += (rnd() * 2 - 1 - lp) * 0.35;
      d[i] = lp * Math.exp(-x * 2.2) * Math.min(1, x / 0.015);
    }
  }
  return b;
}

// ---------- Storskjermen: på som standard, lavt volum, husker valget ----------
const KEY = 'kwest-sound';
const DEFAULT_VOL = 0.5;
let cfg = { muted: false, vol: DEFAULT_VOL };
try { cfg = { ...cfg, ...JSON.parse(localStorage.getItem(KEY)) }; } catch { /* ingen lagring */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch { /* ingen lagring */ } };

let ac = null, eng = null, timer = null, track = 'whiteTiger';
let want = { name: null, opts: {} };
const playing = new Set();
const running = () => ac && ac.state === 'running';

function boot() {
  if (ac) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try { ac = new AC({ latencyHint: 'playback' }); } catch { return; }
  eng = createEngine(ac, { soundtrack: track });
  eng.volume(cfg.vol);
  ac.onstatechange = () => { if (running()) { eng.setScene(want.name, want.opts); } refreshButton(); };
  timer = setInterval(() => { if (running()) eng.pump(ac.currentTime + 0.35, ac.currentTime); }, 60);
  if (cfg.muted) ac.suspend().catch(() => {}); else ac.resume().catch(() => {});
  // Nettlesere slipper ikke lyd ut før noen har klikket på siden.
  const unlock = () => { if (!cfg.muted && ac.state !== 'running') ac.resume().catch(() => {}); };
  ['pointerdown', 'keydown'].forEach(e => document.addEventListener(e, unlock, true));
  // Spørsmålets egen lyd/video får plassen: musikken trekker seg unna mens den spiller.
  document.addEventListener('play', e => { if (e.target instanceof HTMLMediaElement) { playing.add(e.target); eng.duck(true); } }, true);
  ['pause', 'ended', 'emptied'].forEach(ev => document.addEventListener(ev, e => {
    if (!playing.delete(e.target)) return;
    if (![...playing].some(m => !m.paused && m.isConnected)) { playing.clear(); eng.duck(false); }
  }, true));
}

export const sound = {
  // Velg lydspor (fra kwestets innstillinger).
  use(id) { if (id === track) return; track = id; eng?.useSoundtrack(id); },
  scene(name, opts = {}) {
    if (want.name === name) Object.assign(want.opts, opts); else want = { name, opts: { ...opts } };
    boot();
    if (running()) eng.setScene(want.name, want.opts);
  },
  tension(p) { want.opts.p = p; if (running()) eng.tension(p); },
  sfx(name, opts) { if (running()) eng.sfx(name, opts); },
  // Knapp og volumglidebryter til topplinjen.
  controls() {
    boot();
    const btn = h('button', { class: 'icon-btn sound-btn', onclick: toggle });
    const range = h('input', { type: 'range', class: 'sound-vol', min: '0', max: '1', step: '0.05', value: String(cfg.vol), 'aria-label': t('host.volume'), title: t('host.volume') });
    range.addEventListener('input', () => {
      cfg.vol = +range.value; save();
      eng?.volume(cfg.vol);
      if (cfg.muted && cfg.vol > 0) toggle();
    });
    const wrap = h('span', { class: 'sound-ctl' }, btn, range);
    refreshButton(wrap);
    return wrap;
  },
};

function toggle() {
  if (!ac) return;
  if (ac.state !== 'running' && !cfg.muted) { ac.resume().catch(() => {}); return; } // første klikk: slå på
  cfg.muted = !cfg.muted; save();
  if (cfg.muted) ac.suspend().catch(() => {}); else ac.resume().catch(() => {});
  refreshButton();
}

function refreshButton(root = document) {
  const btn = root.querySelector?.('.sound-btn');
  if (!btn) return;
  const on = !cfg.muted, waiting = on && !running();
  btn.replaceChildren(icon(on ? 'sound' : 'mute', 20));
  btn.classList.toggle('off', !on);
  btn.classList.toggle('waiting', waiting);
  const label = waiting ? t('host.soundWaiting') : on ? t('host.soundOff') : t('host.soundOn');
  btn.title = label; btn.setAttribute('aria-label', label); btn.setAttribute('aria-pressed', String(on));
}
