# DevizConstruct.ro

(repo: constructiidevize.ro)

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
scripts/cpanel-unpack.sh  rulat din cron pe cPanel: despachetează arhiva urcată de GitHub și repornește aplicația
src/app/                pagini: site public, (auth), panou, admin, api/health
src/lib/                bază de date, autentificare, email, planuri, module
src/components/         componente UI
.github/workflows/      build automat și publicare (arhivă prin FTP)
```

## Dezvoltare locală

```bash
cp .env.example .env        # completează datele MySQL
npm install
npm run db:migrate          # creează tabelele
npm run dev                 # http://localhost:3000
```

Dacă `SMTP_HOST` e gol, emailurile (confirmare, resetare) se afișează în consolă și confirmarea contului nu e obligatorie.
Cu SMTP configurat (`SMTP_HOST`, `SMTP_PORT` 465, `SMTP_USER` = admin@devizconstruct.ro, `SMTP_PASSWORD`, opțional `MAIL_FROM`, `ADMIN_EMAIL`), conturile noi trebuie confirmate; jurnalul și butonul de test sunt în admin → Setări.
Alertele zilnice (documente care expiră, termene) rulează din aplicație după ora 8; `/api/cron/alerte?key=CRON_SECRET` rămâne pentru rulare manuală.

Pentru a deveni admin de platformă, creează-ți un cont din site, apoi rulează:

```bash
npm run admin:create -- emailul@tau.ro
```

## Teste

```bash
npm test          # motorul de calcul, formula cantității, verificatorul, importul F3, Excel (dacă e instalat LibreOffice)
npm run test:db   # cu baza de date (DB_* setate): izolarea firmelor, refolosirea potrivirilor fără apeluri la asistent
```

`npm test` rulează și în GitHub Actions, înainte de build; dacă un test pică, nu se publică nimic.

## Publicare pe cPanel

Fluxul: **push pe `main` → GitHub Actions face build-ul → îl urcă prin FTP ca o singură arhivă în `.deploy/` → cron-ul din cPanel (la fiecare minut) o despachetează și repornește aplicația → la pornire, aplicația își aplică singură migrările SQL noi.** Durează 1–3 minute; progresul se vede în tabul *Actions* de pe GitHub. Dacă build-ul eșuează, site-ul rămâne pe versiunea veche.

### O singură dată, la configurare

1. **Baza de date.** În *MySQL Databases*, creează baza și utilizatorul, apoi dă-i acestuia toate drepturile pe bază. Tabelele se creează automat la prima publicare.
2. **Aplicația Node.** În *Setup Node.js App → Create Application*:
   - Node.js version: 22
   - Application mode: Production
   - Application root: `constructiidevize`
   - Application URL: domeniul
   - Application startup file: `server.js`
   - Environment variables: `APP_URL`, `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `CRON_SECRET`, plus `SMTP_*` / `MAIL_FROM` pentru email și `ANTHROPIC_API_KEY` pentru asistent.
3. **Cont FTP.** În *FTP Accounts*, creează un cont al cărui *Directory* este folderul aplicației (`constructiidevize`).
4. **Secrets pe GitHub** (*Settings → Secrets and variables → Actions → New repository secret*):
   - `FTP_SERVER`: serverul FTP (de ex. `ftp.domeniul.ro`)
   - `FTP_USERNAME`, `FTP_PASSWORD`: contul de la pasul 3
   - `FTP_DIR` (opțional): folderul aplicației față de rădăcina contului FTP, dacă nu e chiar rădăcina (de ex. `constructiidevize/`)
   - `SITE_URL`: de ex. `https://domeniul.ro`
5. **Cron de publicare.** În *Cron Jobs*, „Once Per Minute (* * * * *)”, cu comanda:
   ```
   /bin/bash $HOME/constructiidevize/.deploy/unpack.sh >> $HOME/constructiidevize-deploy.log 2>&1
   ```
   Scriptul (`scripts/cpanel-unpack.sh`) e urcat de GitHub la fiecare publicare; dacă nu e nicio arhivă nouă, nu face nimic.
6. **Alerte zilnice pe email.** În *Cron Jobs*, o dată pe zi:
   ```
   curl -s "https://domeniul.ro/api/cron/alerte?key=CRON_SECRET" > /dev/null
   ```
7. **Fișiere încărcate.** Documentele clienților se salvează în `~/constructiidevize-uploads`, în afara aplicației, ca să nu fie atinse la publicare. Folderul se poate schimba cu `UPLOAD_DIR`. Include-l în backup.
8. **Asistentul AI.** Adaugă `ANTHROPIC_API_KEY` (cheia din console.anthropic.com) în variabilele aplicației. Fără cheie, platforma merge normal, iar asistentul apare ca neactivat. Pentru teste fără cost, `AI_MOCK=1` întoarce răspunsuri simulate. Modelul implicit e `claude-opus-5-5` și se schimbă cu `AI_MODEL`.
9. **Verificare.** `https://domeniul/api/health` trebuie să răspundă cu `{"ok":true,"db":true,"build":"…"}` (`build` = commit-ul publicat).
10. **Admin.** Creează-ți un cont din site, apoi în phpMyAdmin, în tabelul `users`, setează `role` = `admin` pe rândul tău.

## Ce poate face clientul

- **Proiecte:** fiecare lucrare sau licitație are o pagină proprie, cu autoritatea contractantă, nr. anunț SEAP, termene (depunere, clarificări etc.), devize și export.
- **Devize:** capitole și articole, desfăcute pe material, manoperă, utilaj, transport și echipament, prin normă × preț. Editorul are patru taburi:
  - **Verificări:** cantități, prețuri și norme 0, dubluri, prețuri sau U.M. diferite pentru aceeași resursă.
  - **Simulator preț & profit:** ajustări pe categorii, cantități și discount; calculează costul real, marja și pragul fără pierdere.
  - **Grafic execuție (Gantt):** echipă pe capitol, zile lucrătoare, date de început și de final.
- **Export Excel cu formule verificabile:** Analize → F3 → F2 → Recapitulație, cu procente editabile, plus C5–C9, F4 și F5. Pe proiect se exportă F1.
- **Manoperă & utilaje:** ore-om, ore de utilaj, costuri și durată, pentru toate devizele.
- **Resurse:** prețurile proprii ale firmei, cu import din Excel, plus catalogul global.
- **Documente:**
  - **Dosarul firmei:** certificate, autorizații, experiență similară, personal, utilaje, cu dată de expirare.
  - **Declarații și formulare:** generate în Word din șabloane, completate automat cu datele firmei, ale proiectului și valoarea din deviz.
- **Dosar complet (ZIP) pe proiect:** devizele în Excel, declarațiile în Word și documentele valabile ale firmei.
- **Firmă & utilizatori:**
  - datele firmei completate automat din ANAF după CUI;
  - colegi invitați pe email, cu rol de administrator sau membru;
  - comutare între firme, dacă utilizatorul face parte din mai multe.
- **Dashboard:** termene în următoarele 14 zile și documente care expiră.
- **Deviz din baza de date:**
  - import F3 din Excel sau text lipit, cu potrivire automată (fără AI) pe rețetele firmei și ale platformei;
  - „Completează cu AI” pentru ce nu se găsește: AI-ul caută în bază prin unelte, cu consum mic de tokeni, iar potrivirile se salvează și se refolosesc;
  - rețete de articole salvate din editor (★).
- **Șantier:**
  - contractul pe proiect;
  - situații de lucrări (cantități curente, anterioare și cumulate, export Excel cu formule);
  - încasări și cheltuieli, cu deviz față de realizat și profit;
  - subcontractanți;
  - jurnal zilnic cu poze de pe telefon.
- **Contul meu:** profil, schimbare parolă, sesiuni active, export al datelor (JSON) și ștergerea contului (GDPR).
- **Asistent AI (Claude), pe fiecare proiect:** se încarcă documentele licitației (PDF, Word, Excel, ZIP, planșe scanate). Analizele disponibile:
  - analiza caietului de sarcini;
  - verificarea documentației față de dosarul firmei;
  - analiza eligibilității;
  - compararea versiunilor după clarificări;
  - întrebări de clarificare SEAP;
  - propunere tehnică și plan SSM/calitate (ciorne);
  - analiza contractului;
  - propunere de materiale.

  Pe lângă analize există un chat pe proiect, care vede documentele, devizele, termenele și dosarul firmei. Rezultatele se descarcă în Word.

## Panoul de admin (`/admin`)

Tot ce ține de platformă se modifică de aici, fără cod:

- **Utilizatori:** căutare, editare (nume, email, rol, email confirmat), deconectare de pe toate dispozitivele și ștergere de cont.
- **Abonamentul fiecărei firme:** plan, status, data de sfârșit a probei și data până la care e plătit.
- **Datele firmei:** CUI, Nr. Reg. Com., adresă.
- **Planuri și prețuri:** nume, preț lunar și anual, număr de utilizatori, funcționalități, plan evidențiat. Modificările apar imediat pe pagina de prețuri.
- **Catalog global de resurse:** adăugare, editare, ștergere și import din Excel. Resursele de aici sunt vizibile tuturor clienților.
- **Setări:** zilele perioadei de probă, procentele implicite pentru cheltuieli indirecte, profit și TVA.
- **Șabloane de documente:** textul declarațiilor și formularelor, cu câmpuri automate. Se pot adăuga, modifica sau dezactiva.
- **Asistent AI:** instrucțiunile fiecărei analize, efortul (cost/calitate), activare/dezactivare, trimiterea PDF-urilor originale, consumul și costul estimat al lunii. Limita de cereri AI pe firmă se setează din Setări.
- **Rețete:** rețetele globale și ale firmelor; o rețetă de firmă poate fi promovată la globală.
- **Pagini:** Termeni, Confidențialitate și alte texte, în Markdown, cu previzualizare.

Fiecare modificare se scrie în jurnalul de activitate.

## Securitate

- Parolele sunt salvate cu scrypt; sesiunile stau în baza de date, în cookie httpOnly.
- Încercările se limitează: 5 logări greșite pe email în 15 minute, 5 înregistrări pe IP pe oră, 3 resetări pe email pe oră.
- Formularul de înregistrare are un câmp-capcană invizibil pentru roboți.
- Anteturi HTTP de securitate: X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy și HSTS în producție.
- Fișierele încărcate stau în afara aplicației și se servesc doar membrilor firmei.

## Ce urmează

1. Plăți Stripe și facturi Oblio; blocarea funcțiilor după expirarea probei.
2. Prețuri de la furnizori și cereri de ofertă (după acorduri cu furnizorii).
3. Batch API pentru devize AI mari; reglarea AI pe date reale (necesită cheie API).
4. Aplicație mobilă (PWA / Capacitor); import BIM/IFC.
5. Textele legale finale (verificate de jurist), completate din admin → Pagini.
