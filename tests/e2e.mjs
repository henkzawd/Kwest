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
quizObj.questions[2].discuss = true; // flervalg: diskuter og stem igjen
// Bilde i forklaringen (vises stort på storskjermen og mobilen)
const diagram = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#fff"/><g stroke="#333" stroke-width="4" fill="none"><rect x="60" y="40" width="130" height="100" rx="20" fill="#E9C9CF"/><rect x="210" y="40" width="130" height="100" rx="20" fill="#C9D9E9"/><rect x="60" y="160" width="130" height="110" rx="20" fill="#D99AA6"/><rect x="210" y="160" width="130" height="110" rx="20" fill="#9AB6D9"/></g><g font-family="sans-serif" font-size="22" text-anchor="middle"><text x="125" y="97">Atrium</text><text x="275" y="97">Atrium</text><text x="125" y="222">Ventrikkel</text><text x="275" y="222">Ventrikkel</text></g></svg>');
quizObj.questions[2].explanationImage = diagram;
quizObj.questions[6].explanationImage = diagram; // tallsvar: forklaringen står ved siden av
quizObj.settings = { ...(quizObj.settings || {}), finale: true }; // siste poenggivende spørsmål teller dobbelt
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
  await teacher.locator('.exp-input').fill('Fordi 2 + 2 = 4.');
  await teacher.locator('.exp-pick input[type=file]').setInputFiles({ name: 'graf.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAPAAAACgCAIAAAC9uXYyAAABTUlEQVR42u3SMQ0AMAwEsfCHECDl0KlzIJRFeLwsGcHp6t8HMUoCDA2GBkODoTE0GBoMDYYGQ2NoMDQYGgwNhsbQYGgwNBgaDI2hwdBgaDA0GBpDg6HB0GBoMDSGBkODocHQYGgMDYYGQ4OhMTQYGgwNhgZDY2gwNBgaDA2GxtBgaDA0GBoMjaHB0GBoMDQYGkODocHQYGgwNIYGQ4OhwdBgaAwNhgZDg6HB0BgaDA2GBkNjaAgZus9ADENjaDA0GBoMjaHB0GBoMDQYGkODocHQYGgwNIYGQ4OhwdBgaAwNhgZDg6HB0BgaDA2GBkODoTE0GBoMDYYGQ2NoMDQYGgyNoVXA0GBoMDQYGkODocHQYGgwNIYGQ4OhwdBgaAwNhgZDg6HB0BgaDA2GBkODoTE0GBoMDYYGQ2NoMDQYGgwNhsbQYGgwNBgaQ0OIBeh74nT8uYgvAAAAAElFTkSuQmCC', 'base64') });
  await teacher.locator('.exp-pick.has img').waitFor();
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
  await teacher.getByText('Uten kobling: kopier og lim inn').click();
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
  await host.locator('.th-pin').waitFor();
  const pin = (await host.locator('.th-pin').textContent()).replace(/\D/g, '');
  const qrOk = await host.locator('.th-qr svg').count();
  if (!qrOk) throw new Error('Mangler QR-kode');
  step('Spill startet med PIN ' + pin);

  const mob = { viewport: { width: 390, height: 780 } };
  const p1 = await ctx.newPage(); await p1.setViewportSize(mob.viewport);
  const p2 = await ctx.newPage(); await p2.setViewportSize(mob.viewport);
  await p1.goto(URL0 + '?pin=' + pin);
  await shot(p1, '06-mobil-navn');
  await p1.getByPlaceholder('Skriv navnet ditt').fill('Ola');
  await p1.getByRole('button', { name: 'Bli med!' }).click();
  await p1.getByText('Klar for kwest!').waitFor();
  // Elev 2 skriver PIN selv
  await p2.goto(URL0);
  await p2.getByPlaceholder('123456').fill(pin);
  await p2.getByRole('button', { name: 'Neste' }).click();
  await p2.getByPlaceholder('Skriv navnet ditt').fill('ola'); // samme navn -> avvist
  await p2.getByRole('button', { name: 'Bli med!' }).click();
  await p2.getByText('Navnet er allerede tatt').waitFor();
  await p2.getByPlaceholder('Skriv navnet ditt').fill('Kari');
  await p2.getByRole('button', { name: 'Bli med!' }).click();
  await p2.getByText('Klar for kwest!').waitFor();
  await host.locator('.walker').nth(1).waitFor();
  await shot(host, '07-lobby');
  step('To elever med (duplikatnavn ble avvist)');
  // Lag og reaksjoner
  await host.locator('.team-pick select').selectOption('2');
  await host.locator('.team-legend .team-badge').nth(1).waitFor();
  await p1.locator('.team-badge').waitFor();
  await p1.locator('.react-btn').first().click();
  await p1.locator('.react-btn').nth(1).click();
  await host.locator('.react-float').first().waitFor({ timeout: 8000 });
  await shot(host, '07b-lobby-lag');
  await shot(p1, '08-mobil-lobby');
  const olaTeam = (await p1.locator('.team-badge').textContent()).replace(/^Lag: /, '');
  step('Lag fordelt (' + olaTeam + '), og reaksjonene flyr over storskjermen');

  await host.getByRole('button', { name: 'Start' }).click();
  // 1: infoside
  await host.locator('.info-text').waitFor();
  await p1.getByText('Se på skjermen').waitFor();
  await shot(host, '09-info');
  await host.getByRole('button', { name: 'Neste' }).click();

  const waitQ = async () => {
    await host.locator('.intro').waitFor();
    await shot(host, 'intro');
    await host.locator('.sunset').waitFor({ timeout: 8000 });
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
  // Diskusjonsspørsmål: ingen fasit ennå, elevene diskuterer og stemmer igjen
  await host.locator('.discuss').waitFor();
  await p2.getByText('Diskuter med sidemannen!').waitFor();
  await p2.locator('.my-answer', { hasText: '2' }).waitFor();
  await shot(host, '12b-diskuter');
  await shot(p2, '12c-mobil-diskuter');
  await host.getByRole('button', { name: /Stem igjen/ }).click();
  await p1.getByText('Stem igjen!').waitFor();
  await host.locator('.sunset').waitFor({ timeout: 8000 });
  await p1.locator('.pbtn', { hasText: '4' }).click();
  await p2.locator('.pbtn', { hasText: '2' }).click();
  await host.locator('.tiles.revealed').waitFor();
  await host.locator('.before-after').waitFor();
  if (!(await host.locator('.tile-first').count())) throw new Error('Mangler første runde i svarkortene');
  step('Diskusjonsspørsmål: to runder med «før → etter» på storskjermen');
  await p1.getByText('Riktig!').waitFor();
  await p2.getByText('Ikke denne gangen').waitFor();
  await host.waitForTimeout(900); await shot(host, '13-resultat');
  if (!(await host.locator('.exp-box').count())) throw new Error('Mangler forklaring på storskjermen');
  if (!(await host.locator('.reveal-cards.big-exp .exp-box.has-img img.exp-img').count())) throw new Error('Mangler bildet i forklaringen på storskjermen');
  await host.locator('.exp-box .exp-img').click();
  await host.locator('.zoom-wrap img').waitFor(); await host.waitForTimeout(300);
  await shot(host, '13b-forklaring-zoom');
  await host.keyboard.press('Escape');
  if (await host.locator('.zoom-wrap').count()) throw new Error('Forstørret bilde lukket seg ikke');
  if (!(await host.locator('.exp-box').count())) throw new Error('Esc på forstørret bilde gikk videre i spillet');
  await p2.locator('.exp-panel').waitFor();
  if (!(await p2.locator('.exp-panel.has-img img.exp-img').count())) throw new Error('Mangler bildet i forklaringen på mobilen');
  await p2.getByText('Riktig svar: 4').waitFor();
  await shot(p2, '15b-mobil-forklaring');
  step('Forklaring med bilde vises på storskjerm og mobil (kan forstørres), med riktig svar for den som svarte feil');
  if (!(await host.locator('.tile.dim').count())) throw new Error('Gale svar er ikke merket');
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
  if (await p1.locator('.exp-panel').count() || await host.locator('.exp-box').count()) throw new Error('Forklaringsboks vist uten forklaring');
  await host.getByRole('button', { name: 'Neste' }).click();
  await host.getByRole('button', { name: 'Neste' }).click();

  // 5: kortsvar – liten skrivefeil godtas
  await waitQ();
  await p1.locator('.ptext input').fill('Hudenn'); await p1.getByRole('button', { name: 'Send' }).click();
  await p2.locator('.ptext input').fill('Hjernen'); await p2.getByRole('button', { name: 'Send' }).click();
  await p1.getByText('Riktig!').waitFor();
  await p2.getByText('Ikke denne gangen').waitFor();
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
  await host.locator('.reveal-split.big-exp .exp-box.has-img').waitFor(); await host.waitForTimeout(900);
  await shot(host, '19-slider-resultat');
  await host.getByRole('button', { name: 'Neste' }).click();
  await host.getByRole('button', { name: 'Neste' }).click();

  // 7: rekkefølge (finalen – siste spørsmål med poeng)
  await host.locator('.intro-badge.finale').waitFor();
  await p1.getByText('Finale!').waitFor();
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
  await p2.getByText('Ikke denne gangen').waitFor();
  await shot(host, '21-rekkefolge-resultat');
  await host.getByRole('button', { name: 'Neste' }).click();
  await host.getByRole('button', { name: 'Neste' }).click();

  // 8: avstemning – siste
  await waitQ();
  await p1.locator('.pbtn').nth(0).click();
  await p2.locator('.pbtn').nth(1).click();
  await host.locator('.tiles.revealed').waitFor();
  await host.getByRole('button', { name: /Toppen/ }).click();
  await host.locator('.podium-scene').waitFor();
  await host.getByText('Anonym oppsummering lagret').waitFor();
  await host.waitForTimeout(3800);
  await shot(host, '22-pallen');
  const firstName = await host.locator('.summit.s1 .summit-name').textContent();
  if (firstName !== olaTeam) throw new Error('Laget til Ola skulle vunnet, vinner: ' + firstName);
  await p1.getByText('Du kom på 1. plass').waitFor();
  await p1.getByText('Laget ditt kom på 1. plass').waitFor();
  await p2.getByText('Du kom på 2. plass').waitFor();
  // Gjennomgang av de vanskeligste spørsmålene
  await host.getByRole('button', { name: /Gå gjennom de vanskeligste/ }).click();
  await host.locator('.review-pct').waitFor();
  await host.locator('.review-body .exp-box.has-img').waitFor(); await host.waitForTimeout(900);
  await shot(host, '22b-gjennomgang');
  while (await host.locator('.review-pct').count()) await host.locator('.hfoot .btn.primary').click();
  await host.locator('.podium-scene').waitFor();
  step('Lagpall og gjennomgang av de vanskeligste spørsmålene');
  await shot(p1, '23-mobil-ferdig');
  const [dl] = await Promise.all([host.waitForEvent('download'), host.getByRole('button', { name: /Last ned resultater/ }).click()]);
  const csv = readFileSync(await dl.path(), 'utf8');
  if (!csv.includes('Ola') || !csv.includes('Plass;Navn;Lag;Høydemeter') || !csv.includes('Hudenn (✓')) throw new Error('Feil i resultatfil:\n' + csv);
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

  // Etiketter, spørsmålsbank og angre
  await host.getByRole('link', { name: 'Mine kwest' }).click();
  const card1 = host.locator('.card').filter({ hasText: 'Min første' });
  await card1.locator('.menu-wrap .icon-btn').click();
  await card1.getByRole('menuitem', { name: 'Etiketter' }).click();
  await host.locator('.modal .label-editor input').fill('Farmakologi');
  await host.locator('.modal .label-editor input').press('Enter');
  await host.locator('.modal').getByRole('button', { name: 'Lagre' }).click();
  await host.locator('.label-filter .label-chip', { hasText: 'Farmakologi' }).click();
  await host.locator('.card').first().waitFor();
  if ((await host.locator('.card').count()) !== 1) throw new Error('Etikettfilteret viser feil antall kwest');
  await shot(host, '25-etiketter');
  await host.locator('.label-filter .label-chip', { hasText: 'Alle' }).click();
  step('Etiketter og filter fungerer');
  await host.locator('.card').filter({ hasText: 'Min første' }).getByRole('link', { name: 'Rediger' }).click();
  await host.locator('.qitem').nth(2).waitFor();
  await host.getByRole('button', { name: /Hent fra andre kwest/ }).click();
  await host.locator('.modal .bank-list').waitFor();
  await host.locator('.modal input[type=search]').fill('kamre');
  await host.locator('.modal .bank-item').first().click();
  await shot(host, '26-sporsmalsbank');
  await host.locator('.modal').getByRole('button', { name: 'Legg til (1)' }).click();
  if ((await host.locator('.qitem').count()) !== 4) throw new Error('Spørsmålsbanken la ikke til spørsmålet');
  await host.locator('.undo-btn').click();
  if ((await host.locator('.qitem').count()) !== 3) throw new Error('Angre virket ikke');
  await host.locator('.redo-btn').click();
  if ((await host.locator('.qitem').count()) !== 4) throw new Error('Gjør om virket ikke');
  await host.locator('.qitem').nth(0).click();
  await host.getByPlaceholder('Skriv spørsmålet her').fill('Hva er 3 + 3?');
  await host.evaluate(() => document.activeElement.blur());
  await host.keyboard.press('Control+z');
  if ((await host.getByPlaceholder('Skriv spørsmålet her').inputValue()) !== 'Hva er 2 + 2?') throw new Error('Ctrl+Z angret ikke skrivingen');
  step('Spørsmålsbank, angre og gjør om fungerer');

  // Prøvekjøring med testelever (ordsky-spørsmålet må ha tekst først)
  await host.locator('.qitem').filter({ hasText: 'Ordsky' }).click();
  await host.getByPlaceholder('Skriv spørsmålet her').fill('Ett ord om hjertet');
  await host.getByRole('button', { name: /Prøvekjør/ }).click();
  await host.waitForURL(/test=1/);
  await host.locator('.walker').nth(4).waitFor();
  if (await host.locator('.th-qr').count()) throw new Error('Prøvekjøring skal ikke vise QR-kode');
  await shot(host, '27-provekjoring');
  await host.getByRole('button', { name: 'Start' }).click();
  for (const end = Date.now() + 150000; Date.now() < end && !(await host.locator('.podium-scene').count());) {
    const btn = host.locator('.hfoot .btn.primary');
    if (await btn.count()) await btn.click(); else await host.waitForTimeout(300);
  }
  await host.locator('.podium-scene').waitFor();
  if (!(await host.locator('.summit-name', { hasText: 'Bot' }).count())) throw new Error('Testelevene kom ikke på pallen');
  step('Prøvekjøring med fem testelever gikk til pallen');
  await host.getByRole('button', { name: 'Avslutt' }).last().click();
  await host.waitForURL(/studio/);

  // Hjemmelekse: læreren lager en lenke, en elev tar leksen alene, læreren ser anonyme resultater
  await host.getByRole('button', { name: /Hjemmelekse/ }).click();
  await host.locator('.modal').getByRole('button', { name: /Lag ny lenke/ }).click();
  const hwLink = await host.locator('.hw-item .invite-link').first().textContent();
  await host.locator('.modal').getByRole('button', { name: 'Vis QR-kode' }).click();
  await host.locator('.hw-qr svg').waitFor();
  await host.keyboard.press('Escape');
  await p1.goto(hwLink);
  await p1.getByRole('button', { name: 'Start' }).click();
  for (let guard = 0; guard < 30 && !(await p1.getByText('Kwest fullført!').count()); guard++) {
    if (await p1.locator('.pbtn', { hasText: /^4$/ }).count()) await p1.locator('.pbtn', { hasText: /^4$/ }).click();
    else if (await p1.locator('.pbtn').count()) await p1.locator('.pbtn').first().click();
    else if (await p1.locator('.ptext input').count()) { await p1.locator('.ptext input').first().fill('Hjerte'); await p1.getByRole('button', { name: 'Send' }).click(); }
    else if (await p1.getByRole('button', { name: /Neste|Se resultatet/ }).count()) { await shot(p1, '28-mobil-lekse-' + guard); await p1.getByRole('button', { name: /Neste|Se resultatet/ }).click(); }
    else await p1.waitForTimeout(200);
  }
  await p1.getByText('2 av 2 riktige').waitFor();
  await p1.getByText('sendt anonymt').waitFor();
  await shot(p1, '29-mobil-lekse-ferdig');
  await host.getByRole('button', { name: /Hjemmelekse/ }).click();
  await host.locator('.hw-item').getByText('1 har fullført').waitFor();
  await host.locator('.hw-results summary').click();
  await shot(host, '30-lekse-resultater');
  await host.locator('.modal').getByRole('button', { name: 'Steng', exact: true }).click();
  await host.locator('.hw-item.closed').waitFor();
  await p1.goto(hwLink);
  await p1.getByText('Leksen er stengt').waitFor();
  step('Hjemmelekse: elev tok leksen anonymt, læreren ser resultatet og kan stenge lenken');

  // Resultater: anonym oppsummering fra spillet (prøvekjøringen lagres ikke)
  await host.keyboard.press('Escape');
  await host.locator('nav.tabs').getByRole('link', { name: 'Resultater' }).click();
  await host.locator('.sum-item').first().waitFor();
  if ((await host.locator('.sum-item').count()) !== 1) throw new Error('Skulle vært nøyaktig én oppsummering (prøvekjøring skal ikke lagres)');
  const sumTop = await host.locator('.sum-item .hw-top').textContent();
  if (!sumTop.includes('2 elever') || !sumTop.includes('% riktige svar')) throw new Error('Feil i oppsummeringen: ' + sumTop);
  await host.locator('.sum-item summary').click();
  await host.locator('.sum-item .hw-row').first().waitFor();
  await shot(host, '31-resultater');
  const stored = await host.evaluate(() => localStorage.getItem('kwest-demo-sessions'));
  if (/Ola|Kari/.test(stored + await host.locator('.sum-item').textContent())) throw new Error('Navn i den anonyme oppsummeringen');
  const [sumDl] = await Promise.all([host.waitForEvent('download'), host.getByRole('button', { name: /Last ned \(Excel\)/ }).click()]);
  const sumCsv = readFileSync(await sumDl.path(), 'utf8');
  if (!sumCsv.includes('Prosent riktige') || /Ola|Kari/.test(sumCsv)) throw new Error('Feil i oppsummeringsfil:\n' + sumCsv);
  // Fra kortet: bare resultatene for dette kwestet
  await host.locator('.sum-item .sum-title').click();
  await host.waitForURL(/#\/resultater\/.+/);
  await host.locator('.sum-item').first().waitFor();
  step('Resultater: anonym oppsummering lagret etter spillet, uten navn, og kan lastes ned');

  // Engelsk
  await p2.goto(URL0);
  await p2.getByRole('button', { name: 'English' }).click();
  await p2.getByRole('button', { name: 'Next' }).waitFor();
  step('Språkbytte fungerer');
  await p2.getByRole('button', { name: 'Norsk' }).click();

  // Anonyme navn: eleven får et dyrenavn i stedet for det hun skrev
  await host.goto(URL0 + 'studio.html');
  await host.locator('.card .btn.primary').first().click();
  await host.locator('.th-pin').waitFor();
  const pin2 = (await host.locator('.th-pin').textContent()).replace(/\D/g, '');
  await p2.goto(URL0 + '?pin=' + pin2);
  await p2.getByText('Bruk gjerne et kallenavn').waitFor();
  await p2.getByPlaceholder('Skriv navnet ditt').fill('Kari');
  await p2.getByRole('button', { name: 'Bli med!' }).click();
  await p2.locator('.banner', { hasText: 'Kari' }).waitFor();
  await host.locator('.walker-name', { hasText: 'Kari' }).waitFor();
  await host.getByRole('button', { name: /Anonyme navn: av/ }).click(); // Kari er allerede med og får nytt navn
  await host.getByRole('button', { name: /Anonyme navn: på/ }).waitFor();
  await p2.locator('.banner').filter({ hasNotText: 'Kari' }).waitFor();
  await p1.goto(URL0 + '?pin=' + pin2);
  await p1.getByPlaceholder('Skriv navnet ditt').fill('Ola');
  await p1.getByRole('button', { name: 'Bli med!' }).click();
  await p1.getByText('Klar for kwest!').waitFor();
  const anon2 = (await p2.locator('.banner').textContent()).trim();
  const anon1 = (await p1.locator('.banner').textContent()).trim();
  await host.locator('.walker').nth(1).waitFor();
  const onScreen = (await host.locator('.walker-name').allTextContents()).map(x => x.trim()).sort();
  if (onScreen.join() !== [anon1, anon2].sort().join() || /Kari|Ola/.test(onScreen.join())) throw new Error(`Anonyme navn virket ikke: mobil «${anon1}», «${anon2}», storskjerm «${onScreen}»`);
  await shot(host, '33-anonyme-navn');
  step(`Anonyme navn: Kari ble «${anon2}», Ola ble «${anon1}»`);

  // Personvernsiden
  const p3 = await ctx.newPage(); await p3.setViewportSize(mob.viewport);
  await p3.goto(URL0);
  await p3.getByRole('link', { name: 'Personvern' }).click();
  await p3.getByRole('heading', { name: 'Personvern i Kwest' }).waitFor();
  await shot(p3, '32-personvern');
  step('Personvernsiden vises');

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
