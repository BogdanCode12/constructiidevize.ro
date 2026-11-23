-- 017: sarcina AI care completează articolele negăsite în bază (editabilă din /admin/ai)
INSERT IGNORE INTO ai_tasks (slug, name, description, effort, needs_files, position, prompt) VALUES
('deviz_ai', 'Completare deviz din bază (AI)', 'Pentru articolele negăsite automat, AI-ul caută în rețete și resurse și propune descompunerea.', 'low', 0, 100,
'Primești articole de deviz (cod, denumire, U.M.) care nu au fost găsite automat în baza de date a platformei.
Pentru fiecare articol propune descompunerea pe resurse, cu consumul (norma) pe unitatea de măsură a articolului.

Cum lucrezi:
1. Caută întâi o rețetă potrivită cu cauta_retete. Dacă una se potrivește (aceeași lucrare, aceeași U.M.), folosește-o: completează reteta_id și lasă resurse goală.
2. Altfel, compune articolul din resurse existente găsite cu cauta_resurse (materiale, manoperă, utilaje, transport). Folosește resursa_id din rezultatele căutării; propune o resursă fără id doar dacă nu există nimic potrivit.
3. Normele să fie realiste pentru practica din România (consumuri de materiale cu pierderi uzuale, ore de manoperă pe U.M.). Pentru manoperă folosește U.M. „ora”.
4. Fă puține căutări, cu termeni scurți și relevanți (2–3 cuvinte). Nu căuta același lucru de mai multe ori.
5. În „nota” scrie scurt ce trebuie verificat de inginer (maxim o propoziție).');
