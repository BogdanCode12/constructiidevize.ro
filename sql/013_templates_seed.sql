-- 013: șabloane de pornire pentru declarații și formulare (editabile din /admin/sabloane).
-- Sunt MODELE ORIENTATIVE: se verifică întotdeauna cu formularele din documentația de atribuire.
-- Sintaxă: „# ” titlu, „## ” subtitlu, rând gol = paragraf nou, {{camp}} = completat automat.

INSERT INTO document_templates (name, category, position, body)
SELECT * FROM (
SELECT 'Formular de ofertă' AS name, 'Formulare' AS category, 1 AS position,
'Operator economic: {{firma.denumire}}
CUI: {{firma.cui}}, Nr. Reg. Com.: {{firma.reg_com}}
Adresa: {{firma.adresa}}

# FORMULAR DE OFERTĂ

Către: {{proiect.autoritate}}

Examinând documentația de atribuire aferentă procedurii {{proiect.anunt}} pentru „{{proiect.denumire}}”, subsemnatul {{firma.reprezentant}}, în calitate de {{firma.functie}} al ofertantului {{firma.denumire}}, ne oferim ca, în conformitate cu prevederile și cerințele cuprinse în documentația menționată, să executăm lucrările pentru suma de {{oferta.valoare_fara_tva}} lei, la care se adaugă taxa pe valoarea adăugată în valoare de {{oferta.tva}} lei, adică un total de {{oferta.valoare_cu_tva}} lei.

Ne angajăm ca, în cazul în care oferta noastră este stabilită câștigătoare, să începem lucrările cât mai curând posibil după primirea ordinului de începere și să terminăm lucrările în conformitate cu graficul de execuție, într-o durată de {{oferta.durata_zile}} zile lucrătoare.

Ne angajăm să menținem această ofertă valabilă pentru o durată de ______ zile, respectiv până la data de __________, și ea va rămâne obligatorie pentru noi și poate fi acceptată oricând înainte de expirarea perioadei de valabilitate.

Până la încheierea și semnarea contractului, această ofertă, împreună cu comunicarea transmisă de dumneavoastră prin care oferta noastră este stabilită câștigătoare, vor constitui un contract angajant între noi.

Înțelegem că nu sunteți obligați să acceptați oferta cu cel mai scăzut preț sau orice altă ofertă pe care o puteți primi.

Data: {{data}}

{{firma.reprezentant}}, {{firma.functie}}
(semnătura autorizată)' AS body
UNION ALL SELECT 'Declarație privind evitarea conflictului de interese (art. 59–60, Legea 98/2016)', 'Declarații', 2,
'Operator economic: {{firma.denumire}}
CUI: {{firma.cui}}

# DECLARAȚIE
## privind neîncadrarea în situațiile prevăzute la art. 59 și art. 60 din Legea nr. 98/2016 privind achizițiile publice

Subsemnatul {{firma.reprezentant}}, în calitate de {{firma.functie}} al ofertantului {{firma.denumire}}, la procedura {{proiect.anunt}} pentru atribuirea contractului „{{proiect.denumire}}”, organizată de {{proiect.autoritate}}, declar pe propria răspundere, sub sancțiunea excluderii din procedură și a sancțiunilor aplicate faptei de fals în declarații, că nu mă aflu în situațiile prevăzute la art. 59 și art. 60 din Legea nr. 98/2016 privind achizițiile publice, cu modificările și completările ulterioare.

Persoanele cu funcții de decizie din cadrul autorității contractante, în ceea ce privește organizarea, derularea și finalizarea procedurii de atribuire, sunt cele menționate în documentația de atribuire.

Subsemnatul declar că informațiile furnizate sunt complete și corecte în fiecare detaliu și înțeleg că autoritatea contractantă are dreptul de a solicita, în scopul verificării și confirmării declarațiilor, orice documente doveditoare de care dispunem.

Data: {{data}}

{{firma.reprezentant}}, {{firma.functie}}
(semnătura autorizată)'
UNION ALL SELECT 'Declarație privind neîncadrarea în art. 164 (Legea 98/2016)', 'Declarații', 3,
'Operator economic: {{firma.denumire}}
CUI: {{firma.cui}}

# DECLARAȚIE
## privind neîncadrarea în situațiile prevăzute la art. 164 din Legea nr. 98/2016

Subsemnatul {{firma.reprezentant}}, reprezentant împuternicit al {{firma.denumire}}, în calitate de ofertant la procedura {{proiect.anunt}} pentru atribuirea contractului „{{proiect.denumire}}”, organizată de {{proiect.autoritate}}, declar pe propria răspundere, sub sancțiunea excluderii din procedură și a sancțiunilor aplicate faptei de fals în declarații, că nu mă aflu în situațiile prevăzute la art. 164 din Legea nr. 98/2016 privind achizițiile publice, respectiv nu am fost condamnat prin hotărâre definitivă a unei instanțe judecătorești pentru comiterea vreuneia dintre infracțiunile enumerate la acest articol.

Subsemnatul declar că informațiile furnizate sunt complete și corecte în fiecare detaliu și înțeleg că autoritatea contractantă are dreptul de a solicita, în scopul verificării și confirmării declarațiilor, orice documente doveditoare de care dispunem.

Data: {{data}}

{{firma.reprezentant}}, {{firma.functie}}
(semnătura autorizată)'
UNION ALL SELECT 'Declarație privind neîncadrarea în art. 165 și 167 (Legea 98/2016)', 'Declarații', 4,
'Operator economic: {{firma.denumire}}
CUI: {{firma.cui}}

# DECLARAȚIE
## privind neîncadrarea în situațiile prevăzute la art. 165 și art. 167 din Legea nr. 98/2016

Subsemnatul {{firma.reprezentant}}, reprezentant împuternicit al {{firma.denumire}}, în calitate de ofertant la procedura {{proiect.anunt}} pentru atribuirea contractului „{{proiect.denumire}}”, organizată de {{proiect.autoritate}}, declar pe propria răspundere, sub sancțiunea excluderii din procedură și a sancțiunilor aplicate faptei de fals în declarații, că nu mă aflu în situațiile prevăzute la art. 165 și art. 167 din Legea nr. 98/2016 privind achizițiile publice.

Subsemnatul declar că informațiile furnizate sunt complete și corecte în fiecare detaliu și înțeleg că autoritatea contractantă are dreptul de a solicita, în scopul verificării și confirmării declarațiilor, orice documente doveditoare de care dispunem.

Data: {{data}}

{{firma.reprezentant}}, {{firma.functie}}
(semnătura autorizată)'
UNION ALL SELECT 'Declarație privind respectarea obligațiilor de mediu, sociale și ale relațiilor de muncă', 'Declarații', 5,
'Operator economic: {{firma.denumire}}
CUI: {{firma.cui}}

# DECLARAȚIE
## privind respectarea reglementărilor obligatorii în domeniile mediului, social și al relațiilor de muncă

Subsemnatul {{firma.reprezentant}}, în calitate de {{firma.functie}} al ofertantului {{firma.denumire}}, participant la procedura {{proiect.anunt}} pentru atribuirea contractului „{{proiect.denumire}}”, declar pe propria răspundere că, la elaborarea ofertei, am ținut cont de obligațiile relevante din domeniile mediului, social și al relațiilor de muncă, stabilite prin legislația adoptată la nivelul Uniunii Europene, legislația națională, prin acorduri colective sau prin tratatele, convențiile și acordurile internaționale în aceste domenii.

Declar că pe parcursul îndeplinirii contractului vom respecta reglementările obligatorii în domeniile mediului, social și al relațiilor de muncă, inclusiv cele privind securitatea și sănătatea în muncă.

Data: {{data}}

{{firma.reprezentant}}, {{firma.functie}}
(semnătura autorizată)'
UNION ALL SELECT 'Scrisoare de înaintare', 'Formulare', 6,
'Operator economic: {{firma.denumire}}
Adresa: {{firma.adresa}}
Telefon: {{firma.telefon}}, e-mail: {{firma.email}}

Către: {{proiect.autoritate}}

# SCRISOARE DE ÎNAINTARE

Ca urmare a anunțului de participare {{proiect.anunt}} privind aplicarea procedurii pentru atribuirea contractului „{{proiect.denumire}}”, noi, {{firma.denumire}}, vă transmitem alăturat oferta noastră, însoțită de documentele de calificare solicitate prin documentația de atribuire.

Avem speranța că oferta noastră este corespunzătoare și vă satisface cerințele.

Persoana de contact: {{firma.reprezentant}}, telefon {{firma.telefon}}, e-mail {{firma.email}}.

Data: {{data}}

Cu stimă,
{{firma.reprezentant}}, {{firma.functie}}'
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM document_templates);
