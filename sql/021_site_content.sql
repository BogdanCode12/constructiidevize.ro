-- 021: texte editabile ale site-ului public + mesajele din formularul de contact

INSERT IGNORE INTO pages (slug, title, body) VALUES
('acasa', 'Devize corecte. Dosare complete. Lucrări sub control.',
'DevizBuild.ro îți construiește devizul din baza de date a platformei, pregătește dosarul de licitație și urmărește execuția pe șantier — într-un singur loc, în limba română.'),
('intrebari-frecvente', 'Întrebări frecvente',
'## Pot începe fără card?
Da. Perioada de probă e gratuită și nu cere card. La final alegi un abonament sau contul rămâne doar pentru citire.

## Ce formulare pot exporta?
Devizul pe obiect (F2), lista cu cantitățile de lucrări (F3), centralizatorul pe obiectiv (F1), listele de consumuri C5–C9, lista de utilaje și echipamente (F4) și fișa tehnică (F5). Excel-ul are formule reale, pe care le poți verifica.

## Cum ajută asistentul AI?
Citește caietul de sarcini și extrage cerințele, verifică ce lipsește din dosar, pregătește întrebări de clarificare și ciorne de propunere tehnică. Toate rezultatele sunt ciorne pe care le verifici și le asumi.

## De unde vin prețurile din deviz?
Din catalogul platformei și din resursele firmei tale, cu prețurile tale. Articolele pe care le salvezi ca rețete sunt recunoscute automat la următoarele importuri.

## Pot lucra împreună cu colegii?
Da. Inviți inginerul, ofertantul sau contabilul în contul firmei, cu rol de administrator sau membru.

## Datele mele sunt în siguranță?
Fiecare firmă își vede doar datele ei. Parolele sunt criptate, fișierele sunt accesibile doar membrilor firmei, iar din contul tău poți descărca sau șterge oricând toate datele.'),
('contact', 'Contact',
'**E-mail:** [adresa de e-mail]

**Telefon:** [număr de telefon]

**Program:** luni – vineri, 9:00 – 17:00

**Firma:** [denumire, CUI, adresă]');

CREATE TABLE IF NOT EXISTS contact_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  company VARCHAR(190) NULL,
  phone VARCHAR(40) NULL,
  message TEXT NOT NULL,
  ip VARCHAR(45) NULL,
  handled TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_contact_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
