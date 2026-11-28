// Temaet «Metropolis»: prøvekjøring med fem testelever, fra venterommet via heis-poengtavlen til pallen.
// Kjør: node tests/city.mjs   (demo-modus, ingen ekte database)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const PORT = 8125;
const ROOT = new URL('..', import.meta.url).pathname;
const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const U = `http://localhost:${PORT}/`;
const quiz = JSON.parse(readFileSync(ROOT + 'eksempler/eksempel-kwest.json', 'utf8'));
quiz.settings = { ...(quiz.settings || {}), theme: 'city' };
const errors = [];
const ok = (cond, msg) => { if (!cond) throw new Error(msg); console.log('•', msg); };
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } });
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "export const SUPABASE_URL = ''; export const SUPABASE_KEY = '';" }));
  ctx.on('page', p => {
    p.on('pageerror', e => errors.push(e.stack || e.message));
    p.on('console', m => { if (m.type() === 'error' || /Mangler tekst/.test(m.text())) errors.push(m.text()); });
  });
  const host = await ctx.newPage();
  await host.goto(U + 'studio.html');
  const now = new Date().toISOString();
  await host.evaluate(([q, now]) => {
    localStorage.setItem('kwest-demo-users', JSON.stringify([{ id: 'u1', email: 'a@b.c', password: 'x', name: 'Lærer', is_admin: true, approved: true, created_at: now }]));
    localStorage.setItem('kwest-demo-session', JSON.stringify('u1'));
    localStorage.setItem('kwest-demo-quizzes', JSON.stringify([{ id: 'q1', owner: 'u1', title: q.title, description: '', data: { settings: q.settings, questions: q.questions }, question_count: q.questions.length, is_private: false, created_at: now, updated_at: now }]));
  }, [quiz, now]);
  await host.goto(U + 'host.html?id=q1&test=1');
  await host.waitForSelector('.trailhead.city .city-card');
  ok(await host.locator('.walker .citizen').count() === 5, 'Venterommet viser Barcode og fem pendlere');
  ok((await host.locator('.react-toggle').textContent()).includes('🙋'), 'Reaksjonene er verdiene fra The Guide');
  let sawBoard = false, sawCoins = false;
  for (let i = 0; i < 120; i++) {
    const phase = await host.evaluate(() => document.querySelector('main')?.className || '');
    if (phase.includes('phase-podium')) break;
    if (phase.includes('phase-question') || phase.includes('phase-intro')) {
      if (!sawCoins && await host.locator('.tile').count()) sawCoins = (await host.locator('.tile').first().getAttribute('style')).includes('#007272');
      const skip = host.locator('.answered .btn.ghost.small').last();
      if (await skip.count()) await skip.click().catch(() => {});
      await host.waitForTimeout(400);
      continue;
    }
    if (phase.includes('phase-scoreboard')) {
      await host.waitForSelector('.city-board .cb-car', { state: 'attached' });
      sawBoard = (await host.locator('.cb-car').count()) === 5 && (await host.locator('.cb-label').first().textContent()).includes('etg');
    }
    const nx = host.locator('.hfoot .btn.primary.big, .lobby-bar .btn.primary.big');
    if (await nx.count()) await nx.first().click().catch(() => {});
    await host.waitForTimeout(400);
  }
  ok(sawCoins, 'Svaralternativene har Metropolis-fargene');
  ok(sawBoard, 'Poengtavlen viser fem heiser med etasjer');
  await host.waitForSelector('.podium-scene.city', { state: 'attached' });
  ok(await host.locator('.podium-scene.city .lift').count() === 3, 'Pallen er de tre trappede tårnene med heiser på taket');
  ok(!errors.length, 'Ingen feil i konsollen' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log('ALT OK');
} finally {
  await browser.close();
  server.kill();
}
