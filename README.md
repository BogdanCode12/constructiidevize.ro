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
6. **Alerte zilnice pe email.** Adaugă `CRON_SECRET` (un text lung, aleator) în variabilele aplicației, apoi un cron zilnic:
   ```
   curl -s "https://domeniul.ro/api/cron/alerte?key=CRON_SECRET" > /dev/null
   ```
7. **Fișiere încărcate.** Documentele clienților se salvează în `~/constructiidevize-uploads`, în afara aplicației, ca să nu fie șterse la publicare. Folderul se poate schimba cu `UPLOAD_DIR`. Include-l în backup.
8. **Asistentul AI.** Adaugă `ANTHROPIC_API_KEY` (cheia din console.anthropic.com) în variabilele aplicației. Fără cheie, platforma merge normal, iar AI-ul apare ca neactivat. Pentru teste fără cost, `AI_MOCK=1` întoarce răspunsuri simulate. Modelul implicit e `claude-opus-5-5` și se schimbă cu `AI_MODEL`.
9. **Verificare.** `https://domeniul/api/health` trebuie să răspundă cu `{"ok":true,"db":true}`.

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
- **Asistent AI:** instrucțiunile fiecărei analize, efortul (cost/calitate), activare/dezactivare, consumul lunii. Limita de cereri AI pe firmă se setează din Setări.

Fiecare modificare se scrie în jurnalul de activitate.

## Ce urmează

1. Plăți Stripe și facturi Oblio; blocarea funcțiilor după expirarea probei.
2. Licitații: căutare în TED, recomandări AI, analiza concurenței.
3. Prețuri de la furnizori, comparare oferte, cereri de ofertă pe email.
4. Șantier: situații de lucrări, financiar proiect, aplicație mobilă; import BIM/IFC.
