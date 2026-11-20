# Oppsett av Kwest – steg for steg

Du trenger bare å gjøre dette **én gang**. Det tar ca. 15 minutter. Alt er gratis.

Kwest består av to deler:
- **Nettsiden** (det elevene og lærerne åpner) – ligger gratis hos Vercel.
- **Databasen** (der kwest og lærerkontoer lagres) – ligger gratis hos Supabase.

---

## Del 1 – Publiser nettsiden (Vercel)

1. Gå til https://vercel.com og logg inn (bruk **Continue with GitHub**).
2. Trykk **Add New…** → **Project**.
3. Finn **Kwest** i listen og trykk **Import**.
   - Ser du den ikke: trykk **Adjust GitHub App Permissions** (eller *Configure GitHub App*) og gi Vercel tilgang til repoet `Kwest`.
4. På neste side:
   - **Framework Preset:** velg **Other**.
   - Ikke endre noe annet. Trykk **Deploy**.
5. Gå til **Settings** → **Domains**, trykk **Edit** på adressen og skriv `kwesting.vercel.app`.

Vercel publiserer automatisk på nytt hver gang Claude oppdaterer hovedversjonen (main).

Nettsiden blir: **https://kwesting.vercel.app/**
Lærersiden (Kwest Studio) blir: **https://kwesting.vercel.app/studio**

---

## Del 2 – Lag databasen (Supabase)

1. Gå til https://supabase.com og trykk **Start your project**. Logg inn med GitHub-kontoen din.
2. Trykk **New project**.
   - **Name:** `Kwest`
   - **Database password:** trykk *Generate a password*. Du trenger det ikke senere, men lagre det gjerne i passordbehandleren din.
   - **Region:** velg en i Europa (f.eks. *Stockholm* eller *Frankfurt*).
   - Trykk **Create new project** og vent et par minutter.
3. **Lag tabellene:**
   - Trykk **SQL Editor** i menyen til venstre.
   - Åpne filen [`supabase/oppsett.sql`](supabase/oppsett.sql) her på GitHub, trykk kopier-knappen (to firkanter øverst til høyre på filen).
   - Lim inn i SQL Editor og trykk **Run**. Det skal stå *Success*.
4. **Slå av e-postbekreftelse** (ellers får ikke kollegene dine laget konto – Supabase sin gratis e-post sender bare til deg selv):
   - Trykk **Authentication** i menyen → **Sign In / Providers** (kan hete *Providers*) → **Email**.
   - Slå av **Confirm email** og trykk **Save**.
5. **Fortell Supabase hvor nettsiden ligger:**
   - **Authentication** → **URL Configuration**.
   - Skriv inn `https://kwesting.vercel.app/studio` i **Site URL** og trykk **Save**.
6. **Hent de to tilkoblingsverdiene:**
   - Trykk **Connect** øverst på prosjektsiden (eller **Project Settings** → **API Keys**).
   - Kopier **Project URL** (ser ut som `https://abcdefgh.supabase.co`).
   - Kopier **Publishable key** (begynner med `sb_publishable_…`). Finnes den ikke, bruk **anon public**-nøkkelen.
   - Lim begge inn i chatten til Claude. Disse to er laget for å være offentlige og er trygge å dele.
   - ⚠️ Del **aldri** nøkkelen som heter **secret** eller **service_role**.

Claude legger verdiene inn i Kwest og publiserer på nytt.

(Har Kwest fått nye funksjoner siden du kjørte `oppsett.sql`, kjør hele filen én gang til – det er trygt.)

---

## Del 3 – Første innlogging

1. Gå til **https://kwesting.vercel.app/studio**
2. Trykk **Lag konto** og lag kontoen din. **Den første kontoen blir automatisk administrator.**
3. Inviter kolleger: gå til fanen **Brukere**, kopier lenken og send den til dem. Når de har laget konto, huker du av **Godkjent** ved navnet deres.

## Godt å vite

- **Glemt passord:** Supabase sin gratis e-post sender bare til deg selv. Glemmer en kollega passordet, kan du slette brukeren i Supabase (**Authentication** → **Users** → de tre prikkene → *Delete user*), og så lager kollegaen ny konto. Kwestene deres blir liggende (uten navn på). Vil dere ha ordentlig «glemt passord»-e-post, kan Claude hjelpe med å koble til en e-posttjeneste senere.
- **Hvor mange elever:** Kwest er testet med 60 samtidige elever og holder seg innenfor gratisgrensene til Supabase (200 tilkoblinger og 100 meldinger i sekundet). Skal dere over ca. 80–100 elever i samme spill, si fra til Claude først.
- **Plass til bilder og lyd:** 1 GB gratis – det rekker til tusenvis av bilder og lydklipp.
- **Gratisprosjekter som ikke brukes på 7 dager** settes på pause av Supabase. Da logger du inn på supabase.com og trykker **Restore project**. Ingenting går tapt.
