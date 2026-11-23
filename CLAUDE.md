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
  (TED, ANAF, BNR) sau date furnizate de utilizator / parteneri.

## Cerință importantă: AI care face devize din baza noastră de date (de implementat)

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

Codul AI existent: `src/lib/ai/` (claude.ts, jobs.ts, files.ts, context.ts); sarcinile AI sunt în tabelul `ai_tasks`.
