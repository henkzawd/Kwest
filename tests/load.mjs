// Belastningstest i demo-modus: 60 simulerte elever spiller en hel Kwest.
// Teller hvor mange sanntidsmeldinger som sendes per sekund (Supabase gratis: maks 100/s).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const N = Number(process.env.N || 60);
const PORT = 8125;
const ROOT = new URL('..', import.meta.url).pathname;
const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const URL0 = `http://localhost:${PORT}/`;
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } });
  // Testene kjører alltid i demo-modus, aldri mot den ekte databasen.
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "export const SUPABASE_URL = ''; export const SUPABASE_KEY = '';" }));
  const host = await ctx.newPage();
  const errors = [];
  host.on('pageerror', e => errors.push(e.message));
  await host.goto(URL0 + 'studio.html');
  await host.getByRole('button', { name: 'Lag konto' }).first().click();
  await host.getByPlaceholder('Navn').fill('Lærer');
  await host.getByPlaceholder('E-post').fill('l@example.com');
  await host.getByPlaceholder('Passord').fill('hemmelig123');
  await host.locator('form button[type=submit]').click();
  await host.getByRole('button', { name: /Importer/ }).click();
  await host.locator('.modal textarea').fill(readFileSync(ROOT + 'eksempler/eksempel-kwest.json', 'utf8'));
  await host.locator('.modal').getByRole('button', { name: 'Importer' }).click();
  await host.getByRole('button', { name: '▶ Start' }).click();
  await host.locator('.lobby-pin strong').waitFor();
  const pin = (await host.locator('.lobby-pin strong').textContent()).replace(/\D/g, '');

  const bots = await ctx.newPage();
  await bots.goto(URL0 + 'tests/blank.html').catch(() => {});
  await bots.evaluate(({ pin, N }) => {
    window.stats = { perSec: {}, kinds: {}, accepted: 0, answered: 0, results: 0 };
    const count = (n, k) => { const s = Math.floor(performance.now() / 1000); stats.perSec[s] = (stats.perSec[s] || 0) + n; const o = (stats.kinds[s] ||= {}); o[k] = (o[k] || 0) + n; };
    // Lærerens «inn»-kanal teller som mottatt hos læreren
    const spy = new BroadcastChannel('kwest-' + pin + '-inn');
    spy.onmessage = e => count(2, 'inn:' + e.data.event); // sendt + levert til læreren
    const spyOut = new BroadcastChannel('kwest-' + pin);
    spyOut.onmessage = e => count(1, 'ut:' + e.data.event + ':' + (e.data.payload.phase || '')); // læreren sendte én melding (leveres til alle elever, telles under)
    for (let i = 0; i < N; i++) {
      const id = 'bot' + i;
      const out = new BroadcastChannel('kwest-' + pin);
      const inn = new BroadcastChannel('kwest-' + pin + '-inn');
      let qi = -1;
      out.onmessage = e => {
        const { event, payload } = e.data;
        count(1, 'ut:' + event + ':' + (payload.phase || '')); // hver elev mottar meldingen
        if (payload.replies?.[id]?.ok) stats.accepted++;
        if (event === 'state' && (payload.phase === 'question' || payload.phase === 'intro') && payload.q && payload.qi !== qi) {
          qi = payload.qi;
          const q = payload.q;
          let v;
          if (q.type === 'wordcloud') v = ['ord' + (i % 9)];
          else if (q.type === 'short') v = i % 2 ? 'huden' : 'lever';
          else if (q.type === 'slider') v = q.min + ((i * 7) % (q.max - q.min));
          else if (q.type === 'order') v = [0, 1, 2, 3].sort(() => Math.random() - .5);
          else v = i % (q.labels ? q.labels.length : 2);
          setTimeout(() => { inn.postMessage({ event: 'answer', payload: { id, qi, value: v } }); stats.answered++; }, 3000 + 500 + Math.random() * 6000);
        }
        if (event === 'state' && payload.phase === 'podium' && payload.results?.[id]) stats.results++;
      };
      // Elevene kommer inn i løpet av ca. 20 sekunder, slik det skjer i et klasserom.
      setTimeout(() => inn.postMessage({ event: 'join', payload: { id, name: 'Elev ' + (i + 1) } }), Math.random() * 20000);
    }
  }, { pin, N });
  await host.locator('.chip').nth(N - 1).waitFor({ timeout: 40000 });
  await host.waitForTimeout(1500);
  await host.screenshot({ path: (process.env.SHOTS || '/tmp') + '/load-lobby.png' });
  await host.getByRole('button', { name: 'Start' }).click();
  let shotTrail = false;
  for (let guard = 0; guard < 400; guard++) {
    if (await host.locator('.podium-scene').count()) break;
    const btn = host.locator('.hfoot .btn.primary');
    if (!shotTrail && await host.locator('.trail-scene').count()) { shotTrail = true; await host.waitForTimeout(2600); await host.screenshot({ path: (process.env.SHOTS || '/tmp') + '/load-sti.png' }); }
    if (await btn.count()) { await host.waitForTimeout(1500); await btn.click(); continue; }
    await host.waitForTimeout(400);
  }
  await host.locator('.podium-scene').waitFor();
  await host.waitForTimeout(3000);
  await host.screenshot({ path: (process.env.SHOTS || '/tmp') + '/load-podium.png' });
  const stats = await bots.evaluate(() => window.stats);
  const peak = Math.max(...Object.values(stats.perSec));
  const total = Object.values(stats.perSec).reduce((a, b) => a + b, 0);
  console.log(`Elever godtatt: ${stats.accepted}/${N}, svar sendt: ${stats.answered}, fikk sluttresultat: ${stats.results}/${N}`);
  const top = Object.entries(stats.perSec).sort((a, b) => b[1] - a[1]).slice(0, 4);
  for (const [sec, n] of top) console.log('  ', n, JSON.stringify(stats.kinds[sec]));
  console.log(`Meldinger: totalt ${total}, travleste sekund ${peak}/s (gratisgrense 100/s)`);
  if (stats.accepted !== N || stats.results !== N) throw new Error('Ikke alle elever kom gjennom');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(peak <= 100 ? 'ALT OK' : 'ADVARSEL: over gratisgrensen');
} catch (e) {
  console.error('FEIL:', e.message); process.exitCode = 1;
} finally { await browser.close(); server.kill(); }
