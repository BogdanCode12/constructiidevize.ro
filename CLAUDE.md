# ConstructiiDevize.ro — note pentru dezvoltare

Platformă SaaS pentru firme de construcții din România: devize (F1–F5, C5–C9), dosar de licitație, asistent AI.
Stack: Next.js 16 + React 19 + TypeScript, Tailwind v4, MySQL/MariaDB (`mysql2`, migrări în `sql/NNN_*.sql`),
găzduire cPanel (Setup Node.js App, build standalone, publicare prin ramura `release` + cron). Detalii în README.md.

## Reguli stabilite cu proprietarul

- Interfața și textele sunt în limba română.
- Tot ce ține de conținutul platformei trebuie să poată fi modificat din panoul de admin (planuri, prețuri,
  catalog de resurse, șabloane de documente, instrucțiunile AI, setări, limite).
- Fără copiere 1:1 după ofertant.ro (alt design, alte fluxuri).
- Fără preluare automată de date de pe site-uri care nu permit asta (SEAP intern, magazine): doar surse oficiale
  (ANAF, BNR) sau date furnizate de utilizator / parteneri.
- **Fără integrare TED** (decizia proprietarului): modulul de căutare licitații a fost scos din plan.

## Cerință importantă: AI care face devize din baza noastră de date

Proprietarul vrea ca asistentul AI să **caute în baza de date a platformei** (catalogul global de resurse,
resursele firmei, articolele și devizele aprobate anterior) ca să construiască un deviz bun, și să **consume cât mai
puțini tokeni**. Direcția agreată:

1. **Potrivire fără AI întâi.** Lista de lucrări (din F3 / caiet de sarcini) se potrivește mai întâi cu articolele
   existente prin căutare în MySQL (FULLTEXT pe denumire, cod, U.M.). AI-ul intervine doar pentru ce nu se găsește
   sau e ambiguu.
2. **AI cu unelte de căutare, nu cu tot catalogul în prompt.** Modelul primește unelte (`cauta_resurse`,
   `cauta_articole`, `reteta_articol`) care întorc doar primele ~10 rezultate, compact (id, denumire, U.M., preț).
   Răspunsul final e JSON structurat cu id-uri din bază (structured outputs), nu text lung.
3. **Rețete refolosibile.** Fiecare articol aprobat de utilizator (articol → resurse + norme) se salvează ca rețetă;
   data viitoare se folosește direct, fără AI. Baza se îmbogățește cu fiecare deviz.
4. **Cache pe mai multe niveluri:**
   - textul extras din PDF/Word/Excel se salvează o singură dată pe fișier și se refolosește în analize și chat
     (nu se retrimite PDF-ul la fiecare cerere);
   - potrivirile AI (denumire normalizată → articol/rețetă) se salvează într-un tabel și se refolosesc între clienți;
   - prompt caching pe system prompt, unelte și documente.
5. **Cost controlat:** efort `low`/`medium` pentru extragere și potrivire, model configurabil din admin,
   Batch API (50% mai ieftin) pentru devize mari care nu sunt urgente, estimare de cost și consum vizibil în admin,
   limită lunară pe firmă (există deja: `ai_monthly_requests`).
6. **Chat-ul** să nu mai trimită toate documentele la fiecare mesaj: rezumate salvate + doar fragmentele relevante.

### Stare implementare

Făcut:
- **Pct. 1:** potrivire fără AI în `src/lib/recipes/repo.ts` (`matchLines`). Ordinea: cod → cheie normalizată → cache AI → căutare FULLTEXT + scor `similarity`.
- **Import F3:** `src/lib/estimate/f3.ts`, din Excel sau din text lipit.
- **Pct. 2:** `src/lib/ai/estimator.ts`. Tool runner din SDK cu unelte strict (`cauta_retete`, `reteta`, `cauta_resurse`), rezultate scurte, separate prin „|”. Răspunsul final e JSON prin `output_config.format`, cu efort `low`. Sarcina `deviz_ai` se poate edita din admin.
- **Pct. 3:** rețetele sunt în tabelele `recipes` și `recipe_resources`. Se salvează din editor: ★ pentru firmă, ★G pentru global (doar admin). Adminul poate promova o rețetă de firmă la globală.
- **Pct. 4:**
  - textul extras se salvează în `project_files.extracted_text`, la încărcare;
  - potrivirile AI sunt în tabelul `ai_match_cache` (globale dacă folosesc doar resurse globale);
  - prompt caching pe system.
- **Pct. 5:** efort configurabil, cost estimat în /admin/ai (prețuri în Setări), opțiunea `send_originals` pe sarcină.
- **Pct. 6:** chat-ul trimite textul extras; la documente mari, doar fragmentele relevante pentru ultima întrebare.

De făcut: Batch API pentru devize mari; reglarea instrucțiunilor și a pragurilor de asemănare pe date reale (necesită cheie API).
Notă: tool runner-ul din SDK folosește automat message threads (beta `message-threads-2026-08-12`).

Codul AI: `src/lib/ai/` (claude.ts, jobs.ts, files.ts, context.ts, estimator.ts); sarcinile AI sunt în tabelul `ai_tasks`.
