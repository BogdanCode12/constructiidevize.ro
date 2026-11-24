-- 024: catalog profesional de resurse — date tehnice, status, oferte de preț cu istoric
--
-- resources.price rămâne „prețul de referință curent” (în lei, fără TVA), sincronizat cu oferta aleasă
-- (current_price_id). NULL = fără preț (nu se mai folosește 0 ca „preț necunoscut”).
-- Ofertele (resource_prices) nu se suprascriu: un preț nou = o ofertă nouă; cele vechi rămân în istoric.
-- O firmă își poate adăuga prețuri proprii (negociate) și pe resursele din catalogul global: company_id = firma.

ALTER TABLE resources
  MODIFY price DECIMAL(14,4) NULL DEFAULT NULL,
  ADD COLUMN category VARCHAR(80) NULL AFTER type,
  ADD COLUMN specs VARCHAR(500) NULL AFTER unit,
  ADD COLUMN producer VARCHAR(120) NULL AFTER specs,
  ADD COLUMN product_code VARCHAR(80) NULL AFTER producer,
  ADD COLUMN status ENUM('neverificat','verificat','inactiv') NOT NULL DEFAULT 'neverificat' AFTER price,
  ADD COLUMN current_price_id BIGINT UNSIGNED NULL AFTER status,
  -- manoperă: tipul tarifului decide dacă se aplică CAM (doar pe „cost_salarial”)
  ADD COLUMN tariff_kind ENUM('cost_salarial','echipa','comercial') NULL AFTER current_price_id,
  ADD COLUMN region VARCHAR(80) NULL AFTER tariff_kind,
  -- utilaje: mobilizare/transport separat (lei pe mobilizare), condiții de tarifare
  ADD COLUMN mobilization_cost DECIMAL(14,2) NULL AFTER region,
  ADD COLUMN conditions VARCHAR(500) NULL AFTER mobilization_cost,
  ADD KEY idx_resources_status (status),
  ADD KEY idx_resources_category (category);

CREATE TABLE IF NOT EXISTS resource_prices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  resource_id BIGINT UNSIGNED NOT NULL,
  company_id BIGINT UNSIGNED NULL,              -- NULL = ofertă din catalogul global; altfel = prețul privat al firmei
  supplier VARCHAR(160) NULL,
  price DECIMAL(14,4) NOT NULL,                 -- în moneda ofertei, fără TVA
  currency CHAR(3) NOT NULL DEFAULT 'RON',
  exchange_rate DECIMAL(12,6) NOT NULL DEFAULT 1,  -- lei pentru o unitate de monedă (1 pentru RON)
  price_ron DECIMAL(14,4) NOT NULL,             -- price × exchange_rate, fără TVA
  source ENUM('manual','import','oferta_furnizor','negociat') NOT NULL DEFAULT 'manual',
  document_url VARCHAR(500) NULL,
  obtained_at DATE NOT NULL,
  valid_until DATE NULL,
  transport_included TINYINT(1) NULL,           -- NULL = necunoscut
  min_qty DECIMAL(16,4) NULL,
  status ENUM('neverificat','verificat','inactiv') NOT NULL DEFAULT 'neverificat',
  notes VARCHAR(500) NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rp_resource (resource_id, company_id, status, obtained_at),
  KEY idx_rp_company (company_id),
  CONSTRAINT fk_rp_resource FOREIGN KEY (resource_id) REFERENCES resources (id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Prețurile orientative puse la început în catalogul global nu au sursă: le scoatem.
-- Denumirile rămân, prețul se completează din admin (cu sursă și dată).
UPDATE resources SET price = NULL, notes = NULL
 WHERE company_id IS NULL AND notes = 'Preț orientativ';

-- Prețurile existente (introduse de firme sau din admin) devin prima ofertă din istoric.
INSERT INTO resource_prices (resource_id, company_id, price, price_ron, source, obtained_at, status)
SELECT id, company_id, price, price, 'manual', DATE(updated_at), 'neverificat'
  FROM resources WHERE price IS NOT NULL AND price > 0;

UPDATE resources r
  JOIN resource_prices p ON p.resource_id = r.id AND p.company_id <=> r.company_id
   SET r.current_price_id = p.id;

-- Prețurile 0 vechi înseamnă „fără preț”.
UPDATE resources SET price = NULL WHERE price = 0;
