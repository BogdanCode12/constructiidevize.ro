-- 026: Reguli de calcul (TVA, CAM, indirecte, profit) cu bază legală și perioadă de valabilitate,
-- șablonul recapitulației și CAM în deviz.
--
-- O regulă nu se suprascrie: o valoare nouă = un rând nou, cu data de la care se aplică. La crearea unui deviz
-- se copiază valorile aplicabile în ziua respectivă; devizele existente nu se schimbă când se schimbă regulile.
-- CAM (contribuția asiguratorie pentru muncă) se aplică DOAR pe manopera cu tarif „cost salarial”,
-- niciodată pe tot devizul și nici pe tarifele comerciale (care includ deja contribuțiile).

CREATE TABLE IF NOT EXISTS calc_rules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  rule_key ENUM('tva','cam','indirecte','profit') NOT NULL,
  value DECIMAL(8,4) NOT NULL,
  legal_basis VARCHAR(300) NULL,
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  status ENUM('neverificat','verificat') NOT NULL DEFAULT 'neverificat',
  notes VARCHAR(500) NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rules_key (rule_key, effective_from),
  CONSTRAINT fk_rules_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Valorile de pornire. Toate „neverificat”: proprietarul platformei le confirmă din admin, cu baza legală.
INSERT INTO calc_rules (rule_key, value, legal_basis, effective_from, effective_to, status, notes)
SELECT * FROM (
  SELECT 'tva' AS rule_key, 19 AS value, 'Codul fiscal (Legea nr. 227/2015), art. 291 alin. (1) — cota standard' AS legal_basis,
         DATE('2017-01-01') AS effective_from, DATE('2025-07-31') AS effective_to, 'neverificat' AS status, 'Istoric' AS notes UNION ALL
  SELECT 'tva', 21, 'Codul fiscal (Legea nr. 227/2015), art. 291 alin. (1) — cota standard, majorată de la 1 august 2025',
         DATE('2025-08-01'), NULL, 'neverificat', 'Cota standard; există cote reduse și excepții legale.' UNION ALL
  SELECT 'cam', 2.25, 'Codul fiscal (Legea nr. 227/2015), Titlul V, Capitolul V^1 — contribuția asiguratorie pentru muncă',
         DATE('2018-01-01'), NULL, 'neverificat', 'Se aplică pe baza salarială (manoperă la cost salarial), nu pe tarife comerciale.' UNION ALL
  SELECT 'indirecte', COALESCE((SELECT CAST(`value` AS DECIMAL(8,4)) FROM settings WHERE `key` = 'default_overhead_pct'), 10), NULL,
         DATE('2000-01-01'), NULL, 'neverificat', 'Valoare implicită a platformei; nu există un procent legal obligatoriu.' UNION ALL
  SELECT 'profit', COALESCE((SELECT CAST(`value` AS DECIMAL(8,4)) FROM settings WHERE `key` = 'default_profit_pct'), 5), NULL,
         DATE('2000-01-01'), NULL, 'neverificat', 'Valoare implicită a platformei; plafonul poate fi impus de documentația de atribuire.'
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM calc_rules);

-- Șablonul recapitulației (valori text în settings):
--   recap_overhead_base: direct (% din cost direct C+M) | manopera (% din manoperă)
--   recap_profit_base:   direct_indirecte (% din direct + indirecte) | direct (% din direct)
--   recap_rounding:      final (fără rotunjiri intermediare) | pret_unitar (prețul unitar pe categorii rotunjit la 2 zecimale)
INSERT IGNORE INTO settings (`key`, `value`) VALUES
('recap_overhead_base', 'direct'),
('recap_profit_base', 'direct_indirecte'),
('recap_rounding', 'final');

-- Devizul păstrează regulile cu care a fost creat.
ALTER TABLE estimates
  ADD COLUMN cam_pct DECIMAL(6,3) NOT NULL DEFAULT 2.25 AFTER vat_pct,
  ADD COLUMN overhead_base ENUM('direct','manopera') NOT NULL DEFAULT 'direct' AFTER cam_pct,
  ADD COLUMN profit_base ENUM('direct_indirecte','direct') NOT NULL DEFAULT 'direct_indirecte' AFTER overhead_base,
  ADD COLUMN rounding_mode ENUM('final','pret_unitar') NOT NULL DEFAULT 'final' AFTER profit_base,
  ADD COLUMN rules_date DATE NULL AFTER rounding_mode;

-- Tipul tarifului manoperei se copiază în deviz odată cu prețul (decide dacă se aplică CAM).
ALTER TABLE estimate_item_resources
  ADD COLUMN tariff_kind ENUM('cost_salarial','echipa','comercial') NULL AFTER price;

ALTER TABLE recipe_resources
  ADD COLUMN tariff_kind ENUM('cost_salarial','echipa','comercial') NULL AFTER price;
