// Ende-til-ende-test i demo-modus: lærer lager konto, importerer et kwest, to elever spiller.
// Kjør: node tests/e2e.mjs   (bilder havner i mappen gitt av SHOTS, ellers ingen bilder)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const PORT = 8123;
const ROOT = new URL('..', import.meta.url).pathname;
const SHOTS = process.env.SHOTS || '';
const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const URL0 = `http://localhost:${PORT}/`;
// Testen legger inn en egen poengtavle-side etter kortsvar-spørsmålet.
const quizObj = JSON.parse(readFileSync(ROOT + 'eksempler/eksempel-kwest.json', 'utf8'));
quizObj.questions.splice(5, 0, { type: 'scoreboard' });
const quizJson = JSON.stringify(quizObj);
const errors = [];
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const step = msg => console.log('•', msg);

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } });
  // Testene kjører alltid i demo-modus, aldri mot den ekte databasen.
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "export const SUPABASE_URL = ''; export const SUPABASE_KEY = '';" }));
  ctx.on('page', p => {
    p.on('pageerror', e => errors.push(p.url() + ': ' + e.message));
    p.on('console', m => { if (m.type() === 'error' || /Mangler tekst/.test(m.text())) errors.push(p.url() + ': ' + m.text()); });
  });
  const teacher = await ctx.newPage();
  await teacher.goto(URL0 + 'studio.html');
  await shot(teacher, '01-login');
  await teacher.getByRole('button', { name: 'Lag konto' }).first().click();
  await teacher.getByPlaceholder('Navn').fill('Henrik');
  await teacher.getByPlaceholder('E-post').fill('test@example.com');
  await teacher.getByPlaceholder('Passord').fill('hemmelig123');
  await teacher.locator('form button[type=submit]').click();
  await teacher.getByRole('heading', { name: 'Mine kwest' }).waitFor();
  step('Lærer laget konto');

  // Lag et kwest for hånd
  await teacher.getByRole('link', { name: '+ Nytt kwest' }).click();
  await teacher.getByPlaceholder('Navn på kwestet').fill('Min første');
  await teacher.getByPlaceholder('Skriv spørsmålet her').fill('Hva er 2 + 2?');
  const opts = teacher.locator('.opt-input');
  await opts.nth(0).fill('3'); await opts.nth(1).fill('4');
  await teacher.locator('.opt-correct').nth(0).click(); // fjern riktig på 3
  await teacher.locator('.opt-correct').nth(1).click(); // sett riktig på 4
  await teacher.locator('.save-status[data-s=saved]').filter({ hasText: 'Lagret' }).waitFor({ timeout: 5000 });
  await shot(teacher, '02-editor');
  await teacher.getByRole('button', { name: '+ Legg til' }).click();
  await shot(teacher, '03-typemeny');
  await teacher.locator('.type-item').filter({ hasText: 'Ordsky' }).click();
  await teacher.getByRole('button', { name: '+ Legg til' }).click();
  await teacher.locator('.type-item').filter({ hasText: 'Poengtavle' }).click();
  await teacher.getByText('Poengtavlen vises nå bare der du legger den inn').waitFor();
  await teacher.locator('.board-slide').waitFor();
  await teacher.waitForTimeout(1500);
  await teacher.getByRole('button', { name: /Innstillinger/ }).click();
  await teacher.getByText('Privat kwest').click();
  await teacher.locator('.modal-wrap').click({ position: { x: 5, y: 5 } });
  await teacher.locator('.priv-chip').waitFor();
  await teacher.waitForTimeout(1500);
  await teacher.getByRole('link', { name: '← Tilbake' }).click();
  await teacher.locator('.card').filter({ hasText: 'Min første' }).waitFor();
  const meta = await teacher.locator('.card').filter({ hasText: 'Min første' }).locator('.card-meta').textContent();
  if (!(await teacher.locator('.card').filter({ hasText: 'Min første' }).locator('.priv').count())) throw new Error('Mangler privat-merke');
  step('Privat kwest merkes med lås');
  if (!meta.includes('3 spørsmål')) throw new Error('Forventet 2 spørsmål, fikk: ' + meta);
  step('Laget og lagret Kwest for hånd');

  // AI-dialogen
  await teacher.getByRole('button', { name: /Lag med AI/ }).click();
  await shot(teacher, '04-ai');
  await teacher.locator('.modal textarea').fill('Her er quizen din:\n```json\n' + quizJson + '\n```');
  await teacher.locator('.modal').getByRole('button', { name: 'Importer' }).click();
  await teacher.locator('.title-input').waitFor();
  if ((await teacher.locator('.qitem').count()) !== 9) throw new Error('Import ga feil antall spørsmål');
  step('Importerte Kwest via AI-dialogen');
  await teacher.locator('.qitem').nth(6).click();
  await shot(teacher, '05-editor-slider');
  // Lydfil på flervalgsspørsmålet (en kort WAV laget her)
  await teacher.locator('.qitem').nth(2).click();
  const wav = (() => {
    const n = 8000, b = Buffer.alloc(44 + n);
    b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
    b.writeUInt32LE(8000, 24); b.writeUInt32LE(8000, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write('data', 36); b.writeUInt32LE(n, 40);
    for (let i = 0; i < n; i++) b[44 + i] = 128 + Math.round(60 * Math.sin(i / 8));
    return b;
  })();
  await teacher.locator('.audio-add input[type=file]').setInputFiles({ name: 'hjertelyd.wav', mimeType: 'audio/wav', buffer: wav });
  await teacher.locator('.audio-edit audio').waitFor();
  await teacher.waitForTimeout(1500);
  await shot(teacher, '05b-editor-lyd');
  step('La til lydfil');

  // Start spillet
  await teacher.getByRole('button', { name: '▶ Start' }).click();
  await teacher.waitForURL(/host\.html/);
  const host = teacher;
  await host.locator('.lobby-pin strong').waitFor();
  const pin = (await host.locator('.lobby-pin strong').textContent()).replace(/\D/g, '');
  const qrOk = await host.locator('.lobby-qr svg').count();
  if (!qrOk) throw new Error('Mangler QR-kode');
  step('Spill startet med PIN ' + pin);

  const mob = { viewport: { width: 390, height: 780 } };
  const p1 = await ctx.newPage(); await p1.setViewportSize(mob.viewport);
  const p2 = await ctx.newPage(); await p2.setViewportSize(mob.viewport);
  await p1.goto(URL0 + '?pin=' + pin);
  await shot(p1, '06-mobil-navn');
  await p1.getByPlaceholder('Skriv navnet ditt').fill('Ola');
  await p1.getByRole('button', { name: 'Bli med!' }).click();
  await p1.getByText('Du er med i kwestet!').waitFor();
  // Elev 2 skriver PIN selv
  await p2.goto(URL0);
  await p2.getByPlaceholder('123456').fill(pin);
  await p2.getByRole('button', { name: 'Neste' }).click();
  await p2.getByPlaceholder('Skriv navnet ditt').fill('ola'); // samme navn -> avvist
  await p2.getByRole('button', { name: 'Bli med!' }).click();
  await p2.getByText('Navnet er allerede tatt').waitFor();
  await p2.getByPlaceholder('Skriv navnet ditt').fill('Kari');
  await p2.getByRole('button', { name: 'Bli med!' }).click();
  await p2.getByText('Du er med i kwestet!').waitFor();
  await host.locator('.chip').nth(1).waitFor();
  await shot(host, '07-lobby');
  await shot(p1, '08-mobil-lobby');
  step('To elever med (duplikatnavn ble avvist)');

  await host.getByRole('button', { name: 'Start' }).click();
  // 1: infoside
  await host.locator('.info-text').waitFor();
  await p1.getByText('Se på skjermen').waitFor();
  await shot(host, '09-info');
  await host.getByRole('button', { name: 'Neste' }).click();

  const waitQ = async () => {
    await host.locator('.intro').waitFor();
    await shot(host, 'intro');
    await host.locator('.timer-ring').waitFor({ timeout: 8000 });
  };
  // 2: ordsky
  await waitQ();
  await p1.locator('.ptext input').fill('Kjærlighet'); await p1.getByRole('button', { name: 'Send' }).click();
  await p2.locator('.ptext input').fill('kjærlighet'); await p2.getByRole('button', { name: 'Send' }).click();
  await host.locator('.cloud-word').first().waitFor();
  if ((await host.locator('.cloud-word').count()) !== 1) throw new Error('Ordsky skulle slå sammen like ord');
  await shot(host, '10-ordsky');
  await host.getByRole('button', { name: 'Neste' }).click();

  // 3: flervalg – Ola riktig (4), Kari feil (2)
  await waitQ();
  await p1.locator('.pbtn').nth(0).waitFor();
  await shot(host, '11-sporsmal');
  await shot(p1, '12-mobil-svar');
  if (!(await host.locator('.audio-box audio').count())) throw new Error('Mangler lyd på storskjermen');
  await p1.locator('.pbtn', { hasText: '4' }).click();
  await p2.locator('.pbtn', { hasText: '2' }).click();
  await host.locator('.tiles.revealed').waitFor();
  await p1.getByText('Riktig!').waitFor();
  await p2.getByText('Feil').waitFor();
  await host.waitForTimeout(900); await shot(host, '13-resultat');
  if (!(await host.locator('.tile-wrong').count())) throw new Error('Gale svar er ikke merket');
  await shot(p1, '14-mobil-riktig');
  await shot(p2, '15-mobil-feil');
  await host.getByRole('button', { name: 'Neste' }).click();
  await host.locator('.trail-scene').waitFor(); await host.waitForTimeout(2600);
  await shot(host, '16-poengtavle');
  await host.getByRole('button', { name: 'Neste' }).click();

  // 4: sant/usant – riktig er Usant
  await waitQ();
  await p1.locator('.pbtn', { hasText: 'Usant' }).click();
  await p2.locator('.pbtn', { hasText: 'Sant' }).first().click();
  await host.locator('.tiles.revealed').waitFor();
  await p1.getByText('Riktig!').waitFor();
  await host.getByRole('button', { name: 'Neste' }).click();
  await host.getByRole('button', { name: 'Neste' }).click();

  // 5: kortsvar – liten skrivefeil godtas
  await waitQ();
  await p1.locator('.ptext input').fill('Hudenn'); await p1.getByRole('button', { name: 'Send' }).click();
  await p2.locator('.ptext input').fill('Hjernen'); await p2.getByRole('button', { name: 'Send' }).click();
  await p1.getByText('Riktig!').waitFor();
  await p2.getByText('Feil').waitFor();
  await shot(host, '17-kortsvar');
  await host.getByRole('button', { name: 'Neste' }).click();
  // Egen poengtavle-side
  await host.locator('.trail-scene').waitFor();
  await p1.getByText('Du er på 1. plass').waitFor();
  step('Egen poengtavle-side vises, og mobilen viser plassering');
  await host.getByRole('button', { name: 'Neste' }).click();

  // 6: tallsvar – Ola 206, Kari lar tiden løpe ut? Nei: Kari svarer 150
  await waitQ();
  await shot(p1, '18-mobil-slider');
  await p1.locator('input[type=range]').evaluate(el => { el.value = 204; el.dispatchEvent(new Event('input')); });
  await p1.getByRole('button', { name: 'Send' }).click();
  await p2.locator('input[type=range]').evaluate(el => { el.value = 150; el.dispatchEvent(new Event('input')); });
  await p2.getByRole('button', { name: 'Send' }).click();
  await p1.getByText('Riktig!').waitFor();
  await shot(host, '19-slider-resultat');
  await host.getByRole('button', { name: 'Neste' }).click();
  await host.getByRole('button', { name: 'Neste' }).click();

  // 7: rekkefølge
  await waitQ();
  // Ola drar feltene i riktig rekkefølge; Kari sender slik de står (alltid stokket = feil)
  const dragTo = async (page, word, slot) => {
    const src = page.locator('.drag-row').filter({ hasText: new RegExp('^\\d' + word + '$') });
    const a = await src.boundingBox();
    const b = await page.locator('.drag-row').nth(slot).boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2, b.y + b.height / 2, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(250);
  };
  const words = ['Celle', 'Vev', 'Organ', 'Organsystem'];
  for (let k = 0; k < 4; k++) await dragTo(p1, words[k], k);
  const got = await p1.locator('.drag-text').allTextContents();
  if (got.join() !== words.join()) throw new Error('Dra og slipp ga feil rekkefølge: ' + got.join());
  await shot(p1, '20-mobil-rekkefolge');
  await p1.getByRole('button', { name: 'Send' }).click();
  await p2.getByRole('button', { name: 'Send' }).click();
  await p1.getByText('Riktig!').waitFor();
  await p2.getByText('Feil').waitFor();
  await shot(host, '21-rekkefolge-resultat');
  await host.getByRole('button', { name: 'Neste' }).click();
  await host.getByRole('button', { name: 'Neste' }).click();

  // 8: avstemning – siste
  await waitQ();
  await p1.locator('.pbtn').nth(0).click();
  await p2.locator('.pbtn').nth(1).click();
  await host.locator('.tiles.revealed').waitFor();
  await host.getByRole('button', { name: /Pallen/ }).click();
  await host.locator('.podium-scene').waitFor();
  await host.waitForTimeout(3800);
  await shot(host, '22-pallen');
  const firstName = await host.locator('.summit.s1 .summit-name').textContent();
  if (firstName !== 'Ola') throw new Error('Ola skulle vunnet, vinner: ' + firstName);
  await p1.getByText('Du kom på 1. plass').waitFor();
  await p2.getByText('Du kom på 2. plass').waitFor();
  await shot(p1, '23-mobil-ferdig');
  const [dl] = await Promise.all([host.waitForEvent('download'), host.getByRole('button', { name: /Last ned resultater/ }).click()]);
  const csv = readFileSync(await dl.path(), 'utf8');
  if (!csv.includes('Ola') || !csv.includes('Plass;Navn;Poeng') || !csv.includes('Hudenn (✓')) throw new Error('Feil i resultatfil:\n' + csv);
  step('Resultatfil lastet ned: ' + csv.split('\n')[1].slice(0, 80));
  step('Spillet gikk gjennom alle 8 typer, Ola vant');

  // Tilbakemelding fra elev (anonym) og lærer, og administratoren ser begge
  await p2.goto(URL0);
  await p2.getByRole('button', { name: 'Gi tilbakemelding' }).click();
  await p2.locator('.modal textarea').fill('Morsomt spill!');
  await p2.locator('.modal').getByRole('button', { name: 'Send' }).click();
  await p2.getByText('Takk for tilbakemeldingen!').waitFor();
  await host.goto(URL0 + 'studio.html');
  await host.getByRole('button', { name: /Gi tilbakemelding/ }).click();
  await host.locator('.modal textarea').fill('Kan vi få flere spørsmålstyper?');
  await host.locator('.modal').getByRole('button', { name: 'Send' }).click();
  await host.locator('.fb-count').filter({ hasText: '2' }).waitFor();
  await host.getByRole('link', { name: /Tilbakemeldinger/ }).click();
  await host.locator('.fb-item').nth(1).waitFor();
  await shot(host, '24-tilbakemeldinger');
  await host.locator('.fb-item').first().getByRole('button', { name: /behandlet/ }).click();
  await host.locator('.fb-count').filter({ hasText: '1' }).waitFor();
  step('Tilbakemeldinger fungerer');

  // Engelsk
  await p2.goto(URL0);
  await p2.getByRole('button', { name: 'English' }).click();
  await p2.getByRole('button', { name: 'Next' }).waitFor();
  step('Språkbytte fungerer');

  if (errors.length) throw new Error('Feil i nettleseren:\n' + errors.join('\n'));
  console.log('ALT OK');
} catch (e) {
  console.error('FEIL:', e.message);
  if (errors.length) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
