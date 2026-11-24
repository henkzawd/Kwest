# Kwest ❗

Kwest er en quiz-app for undervisning, i samme stil som Kahoot. Læreren viser spørsmålene på storskjerm, og elevene svarer på mobilen.

**Nettside:** https://kwestlog.vercel.app/ (elever) · https://kwestlog.vercel.app/studio (lærere)

Første gang: følg [OPPSETT.md](OPPSETT.md).

## Slik fungerer det

**For læreren**
1. Logg inn på lærersiden og trykk **Nytt kwest** (eller **Lag med AI** / **Importer**).
2. Legg til spørsmål. Hvert spørsmål kan ha tekst, bilde, lyd (f.eks. en hjertelyd) og svaralternativer. Alt lagres automatisk.
3. Trykk **▶ Start**. Storskjermen viser et skilt ved foten av fjellet med en QR-kode og en Kwest-kode. Elevene dukker opp som små turgåere på marka – og en sjelden gang som en fjellgeit.
4. Trykk **Start** når elevene er med. Trykk **Neste** (eller mellomromstasten) for å gå videre.
5. Til slutt vises **toppen** med vinneren. Her kan du også **laste ned resultatene** (åpnes i Excel).

**For eleven**
1. Skann QR-koden (eller gå til nettsiden og skriv Kwest-koden).
2. Skriv navnet ditt og trykk **Bli med!** Mobilen viser turgåeren (eller geita) du fikk.
3. Trykk på kortet med riktig svar (hvert svar har sin farge og sitt symbol: sol, bølge, lyng og måne). Raske riktige svar gir flest høydemeter (50–100 m per spørsmål).

Navnene til elevene lagres ikke noe sted – de forsvinner når spillet er over (med mindre læreren selv laster ned resultatene).

Kwest er testet med 60 elever i samme spill.

## Spørsmålstyper

| Type | Hva elevene gjør |
|---|---|
| Flervalg | Velger ett av 2–4 alternativer (ett eller flere kan være riktige) |
| Sant/usant | Velger sant eller usant |
| Kortsvar | Skriver et kort svar (små skrivefeil kan godtas) |
| Avstemning | Stemmer – ingen fasit, ingen poeng |
| Ordsky | Skriver 1–3 ord som blir til en ordsky på storskjermen |
| Tallsvar | Gjetter et tall med en glidebryter (med slingringsmonn) |
| Rekkefølge | Trykker alternativene i riktig rekkefølge |
| Infoside | Bare tekst og bilde – til introduksjon eller oppsummering |
| Poengtavle | Viser stillingen så langt – legg den inn der du vil, f.eks. halvveis |

Andre funksjoner: lyd på spørsmål og infosider (lenke eller opplastet .mp3/.wav), kopiere kollegers kwest til sine egne, nedlasting av resultater, poengtavle mellom spørsmålene, «3 på rad», doble høydemeter, stokking av svaralternativer, låsing av spillet, fjerne elever, fullskjerm, norsk og engelsk.

## I klasserommet

- **Lag:** Velg antall lag (2–8) i lobbyen. Elevene fordeles tilfeldig og jevnt, og lagene konkurrerer på snittpoeng (så det er rettferdig selv om lagene er ulikt store).
- **Diskuter med sidemannen:** Huk av **Diskusjon (to runder)** på et flervalg-, sant/usant- eller avstemningsspørsmål – eller trykk **💬 Diskuter** mens spørsmålet pågår. Elevene svarer, diskuterer, og svarer på nytt. Storskjermen viser svarene **før → etter**. Bare andre runde gir poeng.
- **Finale:** Slå på **Finale** under ⚙ Innstillinger, så teller det siste spørsmålet dobbelt og annonseres som «Finale!».
- **Største klatrer:** Poengtavlen viser hvem som klatret flest plasser, og eleven får beskjed på mobilen.
- **Reaksjoner:** Elevene kan sende 🐐 og ⛰️ som flyr over storskjermen i lobbyen og mellom spørsmålene. Slå av med knappen øverst på storskjermen.
- **Gå gjennom de vanskeligste:** Etter pallen kan du vise de tre spørsmålene flest svarte feil på, med riktig svar, vanligste gale svar og forklaring.

## Før og etter timen

- **Prøvekjør:** Spill gjennom kwestet med fem testelever som svarer tilfeldig, før du bruker det i klassen. Ingenting lagres.
- **Hjemmelekse:** Lag en lenke elevene kan ta kwestet med alene, når de vil. De ser riktig svar og forklaring etter hvert spørsmål. Ingen navn lagres – du ser bare hvor mange som har tatt den og hvor mange prosent som svarte riktig på hvert spørsmål. Du kan stenge lenken når du vil.
- **Etiketter:** Gi kwestene etiketter (f.eks. «Farmakologi» eller «4. semester») og trykk på en etikett i oversikten for å vise bare dem.
- **Hent fra andre kwest:** Søk i alle kwest du har tilgang til og kopier enkeltspørsmål inn i ditt eget.
- **Angre:** Angre- og gjør om-knappene (eller Ctrl+Z / Ctrl+Y) tar tilbake endringer i redigeringen.

## Lage Kwest med AI (fra PowerPoint, PDF, artikler)

**Anbefalt: koble Claude til Kwest.** Hver lærer kobler Claude-kontoen sin til Kwest-kontoen én gang (fremgangsmåten står under **Lag med AI** i Kwest Studio og på https://kwestlog.vercel.app/koble). Etterpå laster du bare opp filen i Claude og skriver for eksempel «Lag et kwest med 10 spørsmål av denne». Kwestet lagres rett i Kwest Studio. Claude kan også finne, endre og utvide kwestene dine, men kan ikke slette dem eller se elevenes svar.

**Uten kobling:** Trykk **Lag med AI** → **Uten kobling: kopier og lim inn**. Kopier instruksen, lim den inn i Claude sammen med filen, og lim svaret tilbake i Kwest.

## Prøve uten database

Er databasen ikke koblet til ennå, kjører Kwest i **demo-modus**: alt lagres bare i nettleseren, og spillet virker bare mellom faner på samme maskin. Fint for å se hvordan det fungerer.
