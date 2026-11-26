// Sjekker at alle tekstnøkler som brukes i koden finnes på norsk og engelsk.
import { readFileSync, readdirSync } from 'node:fs';
const src = readFileSync(new URL('../js/i18n.js', import.meta.url), 'utf8');
const block = name => src.slice(src.indexOf(`const ${name} = {`), src.indexOf('};', src.indexOf(`const ${name} = {`)));
const keys = b => new Set([...b.matchAll(/'([a-zA-Z]+\.[a-zA-Z0-9]+)'\s*:/g)].map(m => m[1]));
const no = keys(block('no')), en = keys(block('en'));
const used = new Set();
for (const f of readdirSync(new URL('../js', import.meta.url))) {
  if (!f.endsWith('.js')) continue;
  const s = readFileSync(new URL('../js/' + f, import.meta.url), 'utf8');
  for (const m of s.matchAll(/\bt\('([a-zA-Z]+\.[a-zA-Z0-9]+)'/g)) used.add(m[1]);
}
// Dynamiske nøkler
for (const p of ['type.', 'typeDesc.']) for (const ty of ['quiz','truefalse','short','poll','wordcloud','slider','order','info']) used.add(p + ty);
for (const k of ['soundtrack.whiteTiger','soundtrack.jotunheimen','soundtrack.none','val.noText','val.twoOptions','val.noCorrect','val.noAnswer','val.twoItems','val.slider','users.approved','users.admin']) used.add(k);
let bad = 0;
for (const k of used) { if (!no.has(k)) { console.log('Mangler norsk:', k); bad++; } if (!en.has(k)) { console.log('Mangler engelsk:', k); bad++; } }
for (const k of no) if (!en.has(k)) { console.log('Bare norsk:', k); bad++; }
console.log(bad ? `${bad} feil` : `OK – ${used.size} nøkler i bruk, ${no.size} definert`);
process.exit(bad ? 1 : 0);
