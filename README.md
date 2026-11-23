# ConstructiiDevize.ro

Platformă SaaS pentru firme de construcții: devize, calcul manoperă și ore de regie, caiet de sarcini, declarații pentru licitații, management de șantier și asistent AI. Acces pe bază de cont și abonament lunar sau anual.

## Tehnologii

- **Next.js 16 + React 19, TypeScript:** site-ul, contul utilizatorului (`/panou`) și panoul de admin (`/admin`), într-un singur proiect.
- **Tailwind CSS v4**, cu font Helvetica.
- **MySQL / MariaDB** prin `mysql2`. Structura bazei e în `sql/001_…sql`, `sql/002_…sql` etc.
- **Autentificare proprie:** parole hash-uite cu scrypt, sesiuni în baza de date (cookie httpOnly), confirmare de email și resetare de parolă prin SMTP.
- **Găzduire:** cPanel, cu „Setup Node.js App” (Passenger).

## Structură

```
sql/                    structura bazei de date (numerotată, se aplică în ordine)
scripts/migrate.mjs     aplică fișierele SQL noi (ține evidența în schema_migrations)
scripts/create-admin.mjs  face admin un cont existent
scripts/cpanel-deploy.sh  rulat din cron pe cPanel: preia build-ul nou și repornește aplicația
src/app/                pagini: site public, (auth), panou, admin, api/health
src/lib/                bază de date, autentificare, email, planuri, module
src/components/         componente UI
.github/workflows/      build automat → ramura `release`
```

## Dezvoltare locală

```bash
cp .env.example .env        # completează datele MySQL
npm install
npm run db:migrate          # creează tabelele
npm run dev                 # http://localhost:3000
```

Dacă `SMTP_HOST` e gol, emailurile (confirmare, resetare) se afișează în consolă.

Pentru a deveni admin de platformă, creează-ți un cont din site, apoi rulează:

```bash
npm run admin:create -- emailul@tau.ro
```

## Publicare pe cPanel

Fluxul: **push pe `main` → GitHub Actions face build-ul → ramura `release` → cron-ul din cPanel îl preia → aplicația repornește singură.**

### O singură dată, la configurare

1. **Baza de date.** În *MySQL Databases*, creează baza și utilizatorul, apoi dă-i acestuia toate drepturile pe bază. Importă fișierele din `sql/` în ordine din phpMyAdmin, sau lasă cron-ul să le aplice (pasul 4).
2. **Aplicația Node.** În *Setup Node.js App → Create Application*:
   - Node.js version: 20 sau 22
   - Application mode: Production
   - Application root: `constructiidevize`
   - Application URL: domeniul
   - Application startup file: `server.js`
   - Environment variables: toate din `.env.example` (`APP_URL`, `DB_*`, `SMTP_*`, `MAIL_FROM`). Adaugă și `NODE_ENV=production`.
3. **Clona ramurii `release`.** Din *Terminal* (sau SSH), după ce adaugi o *deploy key* (doar citire) în GitHub → Settings → Deploy keys:
   ```bash
   git clone -b release git@github.com:BogdanCode12/constructiidevize.ro.git ~/constructiidevize-release
   ```
4. **Migrările din cron.** Ca să ruleze automat migrările la publicare, creează `~/constructiidevize/.env` cu aceleași valori `DB_*`. Acesta e singurul loc din afara cPanel-ului unde stau parolele; fișierul nu e în git și nu e șters la publicare.
5. **Cron.** În *Cron Jobs*, la fiecare 5 minute:
   ```
   /bin/bash $HOME/constructiidevize-release/scripts/cpanel-deploy.sh >> $HOME/logs/deploy.log 2>&1
   ```
6. **Verificare.** `https://domeniul/api/health` trebuie să răspundă cu `{"ok":true,"db":true}`.

## Ce urmează

1. Editorul de deviz: capitole, articole, resurse (materiale, manoperă, utilaje), recapitulație, export Excel/PDF (F1–F3, C5–C9).
2. Plăți Stripe (lunar/anual) și facturi Oblio.
3. Datele firmei după CUI din ANAF, invitarea colegilor, roluri.
4. Calcul manoperă și ore de regie, apoi Asistentul AI (import PDF, Excel, planuri).
5. Limitarea încercărilor de autentificare și monitorizarea erorilor.
