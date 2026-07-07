# Ledenbeheer — dansschool & sportschool app

Complete ledenbeheer-app: dashboard, ledenbestand (live gekoppeld aan Google Sheets), lesoverzicht, maandelijkse incasso met goedkeuring, storneringen met automatische betaalmails, groepsmail, rooster (Google Agenda) en een docentenportaal met presentielijsten.

## Direct starten (demo-modus)

```bash
npm install
npm run dev
```

Open http://localhost:3000 en log in met:

| Rol        | E-mail          | Wachtwoord |
|------------|-----------------|------------|
| Management | admin@demo.nl   | demo1234   |
| Docent     | docent@demo.nl  | demo1234   |

Zonder koppelingen draait alles op ingebouwde demo-data. Elke koppeling die je in `.env.local` invult (kopieer `.env.example`) wordt automatisch actief — de pagina **Instellingen** in de app laat zien wat er al gekoppeld is.

---

## Wat jij moet doen om alles werkend te krijgen

### Stap 1 — Google Cloud project (±15 min, eenmalig)
1. Ga naar https://console.cloud.google.com en maak een nieuw project (bijv. "dansschool-app").
2. Zet onder **APIs & Services → Library** deze API's aan: **Google Sheets API**, **Google Calendar API**, **Gmail API**.
3. Maak onder **IAM & Admin → Service Accounts** een service-account aan. Maak een sleutel (JSON) en download die.
4. Zet uit het JSON-bestand `client_email` en `private_key` in `.env.local` (`GOOGLE_SERVICE_ACCOUNT_EMAIL` en `GOOGLE_PRIVATE_KEY`).

### Stap 2 — Ledenspreadsheet koppelen (±10 min)
1. Maak (of hergebruik) een Google Spreadsheet en deel hem met het service-account e-mailadres (rechten: **bewerker**).
2. Zet het spreadsheet-ID (het lange deel uit de URL) in `GOOGLE_SHEET_ID`.
3. Maak deze tabbladen aan, met rij 1 exact deze kolomkoppen:

   - **Leden**: `id | voornaam | achternaam | geboortedatum | email | telefoon | iban | membership | lessen | status | inschrijfdatum | uitschrijfdatum | notities`
     - `geboortedatum`/datums als `2018-06-15`, `lessen` = les-id's gescheiden door komma's, `status` = `actief`/`proefles`/`uitgeschreven`
   - **Lessen**: `id | naam | dag | tijd | duurMinuten | docentNaam | docentEmail | locatie`
   - **Presentie**: `datum | lesId | lidId | aanwezig` (wordt door de app gevuld)
   - **Incasso**: `maand | status | regelsJson` (wordt door de app gevuld)
   - **Storneringen**: `id | datum | lidId | naam | bedrag | reden | status | betaallink`
   - **Gebruikers**: `email | naam | rol | wachtwoordHash` — rol is `management` of `docent`

   Wijzigingen die je rechtstreeks in de spreadsheet doet zijn direct zichtbaar in de app en andersom.

### Stap 3 — Inloggen & beveiliging (±10 min)
1. Genereer een `APP_SECRET`: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Vul het tabblad **Gebruikers** met je teamleden. Wachtwoord-hash genereren:
   `node -e "const c=require('crypto');console.log(c.createHash('sha256').update(process.env.APP_SECRET+':'+'JOUWWACHTWOORD').digest('hex'))"`
   (met `APP_SECRET` als omgevingsvariabele gezet). Docenten met rol `docent` zien alleen hun eigen lessen en presentielijsten.

### Stap 4 — Gmail koppelen (±20 min)
1. Maak in hetzelfde Google Cloud project onder **APIs & Services → Credentials** een **OAuth client ID** (type: Web application, redirect URI: `https://developers.google.com/oauthplayground`).
2. Ga naar https://developers.google.com/oauthplayground, klik rechtsboven op het tandwiel → "Use your own OAuth credentials" en vul je client ID/secret in.
3. Autoriseer scope `https://mail.google.com/` met het Gmail-account waarmee je wilt mailen en wissel de code in voor een **refresh token**.
4. Zet `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` en `GMAIL_FROM` in `.env.local`.

### Stap 5 — Mollie voor de incasso (±30 min + wachttijd op activatie)
1. Maak een account op https://www.mollie.com (activatie vraagt KvK + bankverificatie, duurt 1–3 werkdagen).
2. Zet SEPA-incasso ("SEPA Direct Debit") aan als betaalmethode en zet je API-key in `MOLLIE_API_KEY` (begin met de test-key).
3. **Machtigingen**: laat elk lid eenmalig een eerste betaling van €0,01 doen via een Mollie-betaallink — Mollie maakt dan automatisch een klant + doorlopende machtiging aan. (Bestaande papieren machtigingen kun je via de Mollie API importeren.)
4. Zet de webhook-URL in je Mollie-dashboard op `https://JOUW-DOMEIN/api/webhooks/mollie` — storneringen komen dan automatisch in de app binnen en het lid krijgt direct een mail met betaallink.

### Stap 6 — Google Agenda's (±5 min)
1. Deel je lesrooster-agenda en je proeflessen-agenda met het service-account e-mailadres (rechten: "Alle details bekijken").
2. Zet beide agenda-ID's in `CALENDAR_ID_ROOSTER` en `CALENDAR_ID_PROEFLESSEN`.

### Stap 7 — Online zetten (±20 min, gratis)
1. Zet het project op GitHub en importeer het op https://vercel.com (gratis Hobby-plan volstaat om te starten).
2. Vul alle variabelen uit `.env.local` in bij Vercel → Project Settings → Environment Variables.
3. Maandelijkse automatische Kids-upgrade: voeg in Vercel een Cron Job toe die op de 1e van de maand `GET /api/cron/upgrades?secret=<CRON_SECRET>` aanroept.

---

## Maandelijkse werkwijze incasso

1. Op de 1e van de maand staat het incassobestand automatisch klaar (pagina **Incasso**).
2. Pas eventueel bedragen/omschrijvingen aan, verwijder regels of voeg extra regels toe (bijv. een nagefactureerde maand).
3. Klik **Batch goedkeuren** → de incasso's gaan via Mollie de deur uit (of download de CSV voor handmatige aanlevering bij je bank).
4. Storneringen verschijnen automatisch op het dashboard; het lid krijgt direct een mail met betaallink.

## Technische opzet

- **Next.js 15 (App Router) + TypeScript + Tailwind CSS** — draait lokaal en gratis op Vercel
- **Google Sheets als database** — geen aparte database nodig, jij houdt de regie in de spreadsheet
- **Eigen login** met HMAC-ondertekende sessiecookies en rollen (management/docent), afgeschermd via middleware
- `lib/db.ts` schakelt automatisch tussen demo-data en de echte spreadsheet zodra de koppeling er is
