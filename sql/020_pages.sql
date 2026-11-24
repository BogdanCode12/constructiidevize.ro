-- 020: pagini de conținut editabile din admin (termeni, confidențialitate, cookie-uri)
CREATE TABLE IF NOT EXISTS pages (
  slug VARCHAR(60) NOT NULL,
  title VARCHAR(190) NOT NULL,
  body MEDIUMTEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO pages (slug, title, body) VALUES
('termeni', 'Termeni și condiții',
'> **Ciornă — trebuie verificată de un jurist înainte de lansare.** Completează câmpurile dintre [paranteze].

## 1. Cine suntem
Platforma ConstructiiDevize.ro este operată de [denumirea firmei], CUI [CUI], cu sediul în [adresa], e-mail [email de contact].

## 2. Contul și abonamentul
- Contul se creează pentru o firmă; titularul răspunde de utilizatorii pe care îi invită.
- Perioada de probă este gratuită și nu necesită card. După expirare, funcțiile se folosesc pe bază de abonament lunar sau anual, la prețurile afișate pe pagina Prețuri.
- [Condiții de plată, facturare, reînnoire și anulare.]

## 3. Ce oferă platforma
Instrumente pentru întocmirea devizelor, documentelor de licitație și urmărirea execuției. Documentele generate (devize, declarații, analize și ciorne create cu ajutorul inteligenței artificiale) sunt **instrumente de lucru**: utilizatorul are obligația să le verifice și își asumă conținutul lor înainte de folosire.

## 4. Datele introduse
Datele și documentele încărcate aparțin utilizatorului. Le prelucrăm doar pentru a furniza serviciul, conform Politicii de confidențialitate.

## 5. Răspundere
[Limitarea răspunderii, disponibilitatea serviciului, forța majoră.]

## 6. Modificări și legea aplicabilă
[Modul de notificare a modificărilor; legea română; instanțele competente.]'),
('confidentialitate', 'Politica de confidențialitate',
'> **Ciornă — trebuie verificată de un jurist / DPO înainte de lansare.** Completează câmpurile dintre [paranteze].

## Operatorul datelor
[Denumirea firmei], CUI [CUI], [adresa], e-mail [email pentru protecția datelor].

## Ce date prelucrăm
- **Cont:** nume, e-mail, parolă (stocată doar ca hash), istoricul autentificărilor (dată, IP).
- **Firmă:** date de identificare (CUI, adresă, reprezentant), completate de utilizator sau preluate din registrul public ANAF.
- **Conținut:** proiecte, devize, documente încărcate, poze din jurnalul de șantier, mesaje către asistentul AI.
- **Jurnal de activitate:** acțiunile importante din cont, pentru securitate și suport.

## De ce
Furnizarea serviciului (contract), securitatea contului și prevenirea abuzurilor (interes legitim), obligații legale (facturare).

## Cu cine le împărtășim
- Furnizorul de găzduire [nume, țară].
- **Asistentul AI:** când folosești funcțiile AI, documentele și întrebările relevante sunt trimise către Anthropic (furnizorul modelului Claude), doar pentru a genera răspunsul.
- [Procesatorul de plăți și serviciul de facturare, când vor fi activate.]

## Cât timp
Cât timp contul este activ; după ștergerea contului, datele se șterg [în termen de X zile], cu excepția celor pe care legea ne obligă să le păstrăm.

## Drepturile tale
Acces, rectificare, ștergere, restricționare, portabilitate, opoziție și plângere la ANSPDCP. Din pagina **Contul meu** îți poți descărca datele și îți poți șterge contul.

## Cookie-uri
Folosim doar cookie-uri strict necesare: sesiunea de autentificare (`cd_session`) și firma activă (`cd_company`). Nu folosim cookie-uri de analiză sau publicitate.');
