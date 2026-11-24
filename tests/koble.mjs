// Tester siden der læreren logger inn og godkjenner Claude-koblingen (koble.html).
// Supabase er byttet ut med en falsk adresse som testen svarer på selv – den ekte databasen brukes aldri.
// Kjør: node tests/koble.mjs   (bilder havner i mappen gitt av SHOTS, ellers ingen bilder)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const PORT = 8124;
const ROOT = new URL('..', import.meta.url).pathname;
const SHOTS = process.env.SHOTS || '';
const FAKE = 'https://fake-supabase.test';
const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const URL0 = `http://localhost:${PORT}/`;
const errors = [];
const step = msg => console.log('•', msg);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const USER = { id: '11111111-1111-1111-1111-111111111111', email: 'anna@skole.no', aud: 'authenticated', role: 'authenticated' };
const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, email: USER.email, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
const decisions = [];

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 820 } });
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: `export const SUPABASE_URL = '${FAKE}'; export const SUPABASE_KEY = 'sb_publishable_test';` }));
  await ctx.route(FAKE + '/**', async r => {
    const req = r.request();
    const url = new URL(req.url());
    const send = (body, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (url.pathname === '/auth/v1/token') {
      const body = JSON.parse(req.postData() || '{}');
      if (body.password !== 'hemmelig123') return send({ error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400);
      return send({ access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r1', user: USER });
    }
    if (url.pathname === '/auth/v1/user') return send(USER);
    if (url.pathname === '/auth/v1/logout') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
    if (url.pathname === '/rest/v1/profiles') {
      const p = { id: USER.id, email: USER.email, name: 'Anna', approved: true, is_admin: false };
      return send(/object/.test(req.headers().accept || '') ? p : [p]);
    }
    if (url.pathname === '/auth/v1/oauth/authorizations/auth-123') {
      return send({ authorization_id: 'auth-123', redirect_uri: 'https://claude.ai/api/mcp/auth_callback', client: { id: 'c1', name: 'Claude' }, user: { id: USER.id, email: USER.email }, scope: 'email' });
    }
    if (url.pathname === '/auth/v1/oauth/authorizations/auth-123/consent') {
      const { action } = JSON.parse(req.postData());
      decisions.push(action);
      return send({ redirect_url: `https://claude.ai/api/mcp/auth_callback?${action === 'approve' ? 'code=abc' : 'error=access_denied'}&state=s` });
    }
    if (url.pathname.startsWith('/rest/v1/')) return send([]); // tomme lister i Kwest Studio
    return send({ message: 'ukjent: ' + url.pathname }, 404);
  });
  await ctx.route('https://claude.ai/**', r => r.fulfill({ contentType: 'text/html', body: '<h1>Claude</h1>' }));
  ctx.on('page', p => {
    p.on('pageerror', e => errors.push(p.url() + ': ' + e.message));
    // (400-svaret fra det bevisst feile passordet er ventet og telles ikke som feil)
    p.on('console', m => { if ((m.type() === 'error' && !/status of 400/.test(m.text())) || /Mangler tekst/.test(m.text())) errors.push(p.url() + ': ' + m.text()); });
  });

  // Uten forespørsel fra Claude: forklaring på hvordan man kobler til.
  const page = await ctx.newPage();
  await page.goto(URL0 + 'koble.html');
  await page.getByRole('heading', { name: 'Koble Kwest til Claude' }).waitFor();
  await page.getByText(`http://localhost:${PORT}/mcp`).waitFor();
  await shot(page, 'k1-forklaring');
  step('Forklaringssiden viser adressen til koblingen');

  // Claude sender læreren hit: logg inn, så godkjenn.
  await page.goto(URL0 + 'koble.html?authorization_id=auth-123');
  await page.getByRole('heading', { name: 'Logg inn for å koble til Claude' }).waitFor();
  await page.getByPlaceholder('E-post').fill('anna@skole.no');
  await page.getByPlaceholder('Passord').fill('feil-passord');
  await page.getByRole('button', { name: 'Logg inn' }).click();
  await page.getByText('Feil e-post eller passord.').waitFor();
  await page.getByPlaceholder('Passord').fill('hemmelig123');
  await page.getByRole('button', { name: 'Logg inn' }).click();
  await page.getByRole('heading', { name: 'Gi Claude tilgang til Kwest?' }).waitFor();
  await page.getByText('anna@skole.no').waitFor();
  await shot(page, 'k2-godkjenn');
  step('Læreren logger inn og ser hva Claude ber om');

  await page.getByRole('button', { name: 'Tillat' }).click();
  await page.waitForURL(/claude\.ai\/api\/mcp\/auth_callback\?code=abc/);
  step('«Tillat» sender læreren tilbake til Claude med godkjenningen');

  // Allerede innlogget: rett til spørsmålet. «Avbryt» sender avslag tilbake.
  await page.goto(URL0 + 'koble.html?authorization_id=auth-123');
  await page.getByRole('button', { name: 'Avbryt' }).click();
  await page.waitForURL(/error=access_denied/);
  if (decisions.join() !== 'approve,deny') throw new Error('Uventede valg: ' + decisions.join());
  step('«Avbryt» sender avslag tilbake til Claude');

  // Kwest Studio viser den nye fremgangsmåten i KI-vinduet.
  await page.goto(URL0 + 'studio.html');
  await page.getByRole('heading', { name: 'Mine kwest' }).waitFor();
  await page.getByRole('button', { name: /Lag med AI/ }).click();
  await page.getByRole('heading', { name: 'Anbefalt: Koble Claude til Kwest' }).waitFor();
  await page.getByText(`http://localhost:${PORT}/mcp`).waitFor();
  await page.getByText('Uten kobling: kopier og lim inn').click();
  await page.getByRole('button', { name: 'Kopier instruks' }).waitFor();
  await shot(page, 'k3-studio');
  step('Kwest Studio forklarer koblingen, og den gamle måten finnes fortsatt');

  if (errors.length) throw new Error('Feil i nettleseren:\n' + errors.join('\n'));
  console.log('OK – koblingssiden virker');
} finally {
  await browser.close();
  server.kill();
}
