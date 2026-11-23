-- 015: sarcinile AI de pornire. Textul („prompt”) se poate modifica oricând din /admin/ai.

INSERT IGNORE INTO ai_tasks (slug, name, description, effort, needs_files, position, prompt) VALUES
('analiza_caiet', 'Analiză caiet de sarcini', 'Extrage toate cerințele licitației: calificare, tehnice, documente, termene, garanții, criterii.', 'high', 1, 1,
'Analizează documentația de atribuire atașată (caiet de sarcini, fișa de date, anunț, anexe) și extrage toate cerințele pe care ofertantul trebuie să le îndeplinească.

Structurează răspunsul pe secțiuni:
1. Date generale — obiectul contractului, autoritatea contractantă, valoarea estimată, durata de execuție, criteriul de atribuire și factorii de evaluare, termenul de depunere și de clarificări, valabilitatea ofertei.
2. Cerințe de calificare — situația personală, capacitatea de exercitare a activității, situația economică și financiară (cifră de afaceri, lichiditate), capacitatea tehnică și profesională (experiență similară, personal cheie, utilaje, certificări).
3. Garanții — de participare și de bună execuție (valoare, formă, durată).
4. Cerințe tehnice — materiale, standarde, normative, soluții tehnice impuse, cerințe de calitate și mediu.
5. Documente care trebuie depuse — listă de verificare, fiecare cu formularul aferent, dacă e precizat.
6. Riscuri și aspecte neclare — clauze dezavantajoase, cerințe restrictive, contradicții între documente, informații lipsă care merită clarificate.

Pentru fiecare cerință indică sursa (documentul și pagina sau secțiunea). Dacă o informație nu apare în documente, scrie „nu este precizat” în loc să presupui.'),

('verificare_dosar', 'Verificare documentație', 'Compară cerințele licitației cu dosarul firmei, devizul și declarațiile disponibile și arată ce lipsește.', 'high', 1, 2,
'Compară cerințele din documentația de atribuire atașată cu ce are deja firma în platformă (datele firmei, documentele din dosar cu valabilitatea lor, devizele proiectului, declarațiile disponibile ca șabloane).

Răspunde cu:
1. Tabel de conformitate — cerință | ce avem în platformă | status (îndeplinit / lipsă / expirat / de verificat) | ce trebuie făcut.
2. Documente lipsă sau expirate, în ordinea urgenței.
3. Neconcordanțe — de exemplu valoarea ofertei peste valoarea estimată, durata din graficul de execuție peste durata cerută, experiență similară sub pragul cerut.
4. Pașii următori, scurți și concreți.

Bazează-te doar pe informațiile primite; când nu poți verifica ceva, marchează „de verificat”.'),

('eligibilitate', 'Analiză eligibilitate', 'Verifică dacă firma îndeplinește condițiile de participare și semnalează riscurile.', 'high', 1, 3,
'Pe baza documentației de atribuire atașate și a datelor firmei din platformă, evaluează dacă firma poate participa la procedură.

Pentru fiecare criteriu de calificare și selecție, spune dacă firma pare să îl îndeplinească, pe ce te bazezi și ce dovadă trebuie prezentată. Semnalează riscurile de respingere și variantele de remediere (asociere, subcontractare, terț susținător, completarea documentelor).

Încheie cu o concluzie clară: „Recomandat să participe”, „Participare posibilă cu condiții” sau „Nerecomandat”, cu motivele principale.'),

('comparare_versiuni', 'Comparare versiuni documentație', 'Identifică modificările dintre versiunea inițială și cea după clarificări / erate.', 'high', 1, 4,
'Fișierele atașate sunt versiuni diferite ale aceleiași documentații (de exemplu caietul de sarcini inițial și cel modificat după clarificări sau erate), în ordinea încărcării.

Identifică toate diferențele relevante pentru ofertant: cerințe adăugate, eliminate sau modificate, cantități schimbate, termene noi, criterii de evaluare modificate, răspunsuri la clarificări care schimbă interpretarea.

Prezintă rezultatul ca tabel: secțiune | versiunea inițială | versiunea nouă | impact asupra ofertei (deviz, documente, termene). Încheie cu lista modificărilor care cer acțiune imediată.'),

('clarificari', 'Întrebări de clarificare SEAP', 'Pregătește întrebări argumentate pentru autoritatea contractantă, cu trimitere la documente.', 'high', 1, 5,
'Pe baza documentației atașate, pregătește solicitări de clarificare pe care ofertantul le poate transmite autorității contractante prin SEAP.

Caută: contradicții între documente, cantități lipsă sau neclare în listele de cantități, cerințe restrictive sau disproporționate, specificații care indică o marcă fără „sau echivalent”, termene nerealiste, informații lipsă necesare ofertării.

Pentru fiecare întrebare scrie: numărul, documentul și secțiunea/pagina, textul întrebării formulat politicos și precis, motivarea (de ce este necesară clarificarea, cu trimitere la principiile achizițiilor publice când e relevant). Ordonează după impactul asupra ofertei.'),

('propunere_tehnica', 'Propunere tehnică (ciornă)', 'Redactează metodologia de execuție, organizarea lucrărilor și documentația tehnică.', 'high', 1, 6,
'Redactează o ciornă de propunere tehnică pentru această licitație, respectând cerințele din documentația atașată și folosind datele din platformă (devizul cu capitolele și cantitățile, graficul de execuție, datele firmei).

Structură recomandată (adaptează la ce cere caietul de sarcini):
1. Prezentarea ofertantului și înțelegerea contractului
2. Metodologia de execuție pe categorii de lucrări, cu tehnologiile și succesiunea operațiilor
3. Organizarea de șantier și resursele alocate (personal, utilaje)
4. Graficul de execuție și justificarea duratelor
5. Asigurarea calității — puncte de control, verificări, încercări
6. Sănătate și securitate în muncă, protecția mediului, gestionarea deșeurilor
7. Riscuri identificate și măsuri de reducere
8. Modul de îndeplinire a cerințelor tehnice — tabel cerință / cum o îndeplinim

Scrie concret, specific acestui proiect, fără formulări generice umplutură. Marchează între [paranteze drepte] informațiile pe care firma trebuie să le completeze sau să le confirme.'),

('analiza_contract', 'Analiză contract', 'Identifică penalități, garanții, obligații, riscuri și termene de plată.', 'high', 1, 7,
'Analizează contractul (sau modelul de contract) atașat din perspectiva executantului.

Extrage:
1. Obligațiile principale ale executantului și ale beneficiarului
2. Termene — execuție, recepții, garanție, notificări
3. Plăți — modalitate, termene, situații de lucrări, avans, retenții
4. Garanții — de bună execuție, constituire, eliberare
5. Penalități și daune-interese — cuantum, plafon, condiții
6. Ajustarea prețului și modificarea contractului
7. Încetare, reziliere, forță majoră
8. Riscuri pentru executant — clauze dezechilibrate sau neclare, cu recomandări de negociere sau clarificare

Indică articolul pentru fiecare punct. Analiza nu înlocuiește verificarea juridică.'),

('ssm_calitate', 'Plan SSM și calitate (ciornă)', 'Pregătește proiectul planului de securitate și sănătate și al planului calității, pentru verificare de specialist.', 'medium', 0, 8,
'Pregătește o ciornă a planului de securitate și sănătate în muncă și a planului de asigurare a calității pentru acest proiect, pe baza lucrărilor din deviz și a documentației atașate (dacă există).

Pentru SSM: riscurile pe categorii de lucrări, măsurile de prevenire, echipamentele de protecție, instruirile, organizarea de șantier, situațiile de urgență.
Pentru calitate: procedurile tehnice de execuție necesare, punctele de control și fazele determinante, verificările și încercările, documentele de calitate (procese-verbale, certificate, declarații de performanță).

Documentul este o ciornă și trebuie verificat și asumat de specialiști (coordonator SSM, responsabil tehnic cu execuția).'),

('materiale', 'Propunere materiale', 'Propune materiale potrivite cerințelor proiectului, pentru aprobarea inginerului.', 'medium', 1, 9,
'Pe baza cerințelor tehnice din documentația atașată și a articolelor din devizul proiectului, propune materialele potrivite pentru fiecare categorie de lucrări.

Pentru fiecare: articolul sau capitolul din deviz, materialul propus cu caracteristicile tehnice relevante (clasă, standard, performanțe), cerința din documentație pe care o respectă, alternative echivalente, observații (disponibilitate, compatibilitate, atenționări). Nu inventa mărci sau prețuri; când documentația impune o caracteristică, citeaz-o.

Propunerile trebuie aprobate de inginerul ofertant înainte de folosire.');
