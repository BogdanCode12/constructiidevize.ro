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

## Ce poate face clientul

- **Proiecte:** fiecare lucrare sau licitație.
- **Devize:** pe proiect, cu capitole și articole. Fiecare articol se desface pe resurse (normă × preț) de tip material, manoperă, utilaj sau transport. Recapitulația cuprinde cheltuielile indirecte, profitul și TVA-ul, cu procente editabile, plus orele de manoperă. Exportul Excel conține un deviz pe articole (F3) și listele C5 (materiale), C6 (manoperă), C7 (utilaje) și C8 (transport).
- **Resurse:** fiecare firmă își ține materialele, manopera, utilajele și transportul cu prețurile proprii. Le poate adăuga, edita, șterge sau importa prin copy-paste din Excel. Pe lângă ele, vede și catalogul global al platformei.

## Panoul de admin (`/admin`)

Tot ce ține de platformă se modifică de aici, fără cod:

- **Utilizatori:** căutare, editare (nume, email, rol, email confirmat), deconectare de pe toate dispozitivele și ștergere de cont.
- **Abonamentul fiecărei firme:** plan, status, data de sfârșit a probei și data până la care e plătit.
- **Datele firmei:** CUI, Nr. Reg. Com., adresă.
- **Planuri și prețuri:** nume, preț lunar și anual, număr de utilizatori, funcționalități, plan evidențiat. Modificările apar imediat pe pagina de prețuri.
- **Catalog global de resurse:** adăugare, editare, ștergere și import din Excel. Resursele de aici sunt vizibile tuturor clienților.
- **Setări:** zilele perioadei de probă, procentele implicite pentru cheltuieli indirecte, profit și TVA.

Fiecare modificare se scrie în jurnalul de activitate.

## Ce urmează

1. Plăți Stripe (lunar/anual) și facturi Oblio; blocarea funcțiilor după expirarea probei.
2. Datele firmei după CUI din ANAF, invitarea colegilor, roluri.
3. Modulul Manoperă: echipe, durată, ore de regie, grafic de execuție.
4. Import F3/Excel direct în deviz, apoi Asistentul AI (PDF, planuri).
5. Limitarea încercărilor de autentificare și monitorizarea erorilor.
