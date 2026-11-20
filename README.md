# Kwest ❗

Kwest er en quiz-app for undervisning, i samme stil som Kahoot. Læreren viser spørsmålene på storskjerm, og elevene svarer på mobilen.

**Nettside:** https://kwesting.vercel.app/ (elever) · https://kwesting.vercel.app/studio (lærere)

Første gang: følg [OPPSETT.md](OPPSETT.md).

## Slik fungerer det

**For læreren**
1. Logg inn på lærersiden og trykk **Nytt kwest** (eller **Lag med AI** / **Importer**).
2. Legg til spørsmål. Hvert spørsmål kan ha tekst, bilde, lyd (f.eks. en hjertelyd) og svaralternativer. Alt lagres automatisk.
3. Trykk **▶ Start**. Storskjermen viser en QR-kode og en PIN.
4. Trykk **Start** når elevene er med. Trykk **Neste** (eller mellomromstasten) for å gå videre.
5. Til slutt vises **pallen** med vinneren. Her kan du også **laste ned resultatene** (åpnes i Excel).

**For eleven**
1. Skann QR-koden (eller gå til nettsiden og skriv PIN-en).
2. Skriv et kallenavn og trykk **Bli med!**
3. Trykk på feltet med riktig svar (fargene har hvert sitt eventyrsymbol: fjell, kompass, ryggsekk og veiskilt). Raske riktige svar gir flest poeng.

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

Andre funksjoner: lyd på spørsmål og infosider (lenke eller opplastet .mp3/.wav), kopiere kollegers kwest til sine egne, nedlasting av resultater, poengtavle mellom spørsmålene, «riktige på rad», dobbel poeng, stokking av svaralternativer, låsing av spillet, fjerne elever, fullskjerm, norsk og engelsk.

## Lage Kwest med AI (fra PowerPoint, PDF, artikler)

1. Trykk **Lag med AI** på lærersiden og velg antall spørsmål.
2. Trykk **Kopier instruks**, åpne Claude (claude.ai), last opp filen din og lim inn instruksen.
3. Kopier hele svaret fra Claude, lim det inn i Kwest og trykk **Importer**.

Du kan også gi filene direkte til Claude Code i en økt her, så lager Claude en ferdig fil du kan importere.

## Prøve uten database

Er databasen ikke koblet til ennå, kjører Kwest i **demo-modus**: alt lagres bare i nettleseren, og spillet virker bare mellom faner på samme maskin. Fint for å se hvordan det fungerer.
