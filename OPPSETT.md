# Oppsett av Kwest – steg for steg

Du trenger bare å gjøre dette **én gang**. Det tar ca. 15 minutter. Alt er gratis.

Kwest består av to deler:
- **Nettsiden** (det elevene og lærerne åpner) – ligger gratis på GitHub.
- **Databasen** (der Kwester og lærerkontoer lagres) – ligger gratis hos Supabase.

---

## Del 1 – Slå på nettsiden (GitHub Pages)

1. Gå til https://github.com/henkzawd/Kwest
2. Trykk **Settings** (tannhjulet øverst til høyre i repoet).
3. Trykk **Pages** i menyen til venstre.
4. Under **Build and deployment** → **Source**: velg **GitHub Actions**.
5. Ferdig. Si fra til Claude, så publiserer Claude nettsiden.

Nettsiden blir da: **https://henkzawd.github.io/Kwest/**
Lærersiden blir: **https://henkzawd.github.io/Kwest/laerer.html**

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
   - Skriv inn `https://henkzawd.github.io/Kwest/laerer.html` i **Site URL** og trykk **Save**.
6. **Hent de to tilkoblingsverdiene:**
   - Trykk **Connect** øverst på prosjektsiden (eller **Project Settings** → **API Keys**).
   - Kopier **Project URL** (ser ut som `https://abcdefgh.supabase.co`).
   - Kopier **Publishable key** (begynner med `sb_publishable_…`). Finnes den ikke, bruk **anon public**-nøkkelen.
   - Lim begge inn i chatten til Claude. Disse to er laget for å være offentlige og er trygge å dele.
   - ⚠️ Del **aldri** nøkkelen som heter **secret** eller **service_role**.

Claude legger verdiene inn i Kwest og publiserer på nytt.

---

## Del 3 – Første innlogging

1. Gå til **https://henkzawd.github.io/Kwest/laerer.html**
2. Trykk **Lag konto** og lag kontoen din. **Den første kontoen blir automatisk administrator.**
3. Inviter kolleger: gå til fanen **Brukere**, kopier lenken og send den til dem. Når de har laget konto, huker du av **Godkjent** ved navnet deres.

## Godt å vite

- **Glemt passord:** Supabase sin gratis e-post sender bare til deg selv. Glemmer en kollega passordet, kan du slette brukeren i Supabase (**Authentication** → **Users** → de tre prikkene → *Delete user*), og så lager kollegaen ny konto. Kwestene deres blir liggende (uten navn på). Vil dere ha ordentlig «glemt passord»-e-post, kan Claude hjelpe med å koble til en e-posttjeneste senere.
- **Hvor mange elever:** Gratisversjonen av Supabase tåler rundt 200 samtidige tilkoblinger – mer enn nok for et klasserom eller en forelesning.
- **Gratisprosjekter som ikke brukes på 7 dager** settes på pause av Supabase. Da logger du inn på supabase.com og trykker **Restore project**. Ingenting går tapt.
