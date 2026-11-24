-- 008: resurse (materiale, manoperă, utilaje, transport)
-- company_id NULL = catalogul global al platformei (editat din admin); altfel = resursele firmei
CREATE TABLE IF NOT EXISTS resources (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NULL,
  type ENUM('material','manopera','utilaj','transport') NOT NULL,
  code VARCHAR(40) NULL,
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  price DECIMAL(14,4) NOT NULL DEFAULT 0,
  notes VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_resources_company_type (company_id, type),
  KEY idx_resources_name (name),
  CONSTRAINT fk_resources_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Câteva resurse de pornire în catalogul global (prețuri orientative, de actualizat din admin)
INSERT INTO resources (company_id, type, code, name, unit, price, notes)
SELECT * FROM (
  SELECT NULL AS company_id, 'material' AS type, 'MAT-001' AS code, 'Ciment CEM II/A-S 42,5R' AS name, 'kg' AS unit, 0.75 AS price, 'Preț orientativ' AS notes UNION ALL
  SELECT NULL, 'material', 'MAT-002', 'Nisip sortat 0-4 mm', 'mc', 95, 'Preț orientativ' UNION ALL
  SELECT NULL, 'material', 'MAT-003', 'Pietriș sortat 4-16 mm', 'mc', 110, 'Preț orientativ' UNION ALL
  SELECT NULL, 'material', 'MAT-004', 'Beton marfă C16/20', 'mc', 420, 'Preț orientativ' UNION ALL
  SELECT NULL, 'material', 'MAT-005', 'Beton marfă C25/30', 'mc', 480, 'Preț orientativ' UNION ALL
  SELECT NULL, 'material', 'MAT-006', 'Oțel beton PC52', 'kg', 4.8, 'Preț orientativ' UNION ALL
  SELECT NULL, 'material', 'MAT-007', 'Bloc ceramic 25x30x24 cm', 'buc', 6.5, 'Preț orientativ' UNION ALL
  SELECT NULL, 'material', 'MAT-008', 'Mortar de zidărie M5', 'mc', 380, 'Preț orientativ' UNION ALL
  SELECT NULL, 'material', 'MAT-009', 'Polistiren expandat EPS 80, 10 cm', 'mp', 32, 'Preț orientativ' UNION ALL
  SELECT NULL, 'material', 'MAT-010', 'Scândură rășinoase 24 mm', 'mc', 1350, 'Preț orientativ' UNION ALL
  SELECT NULL, 'manopera', 'MAN-001', 'Zidar', 'ora', 45, 'Preț orientativ' UNION ALL
  SELECT NULL, 'manopera', 'MAN-002', 'Betonist', 'ora', 42, 'Preț orientativ' UNION ALL
  SELECT NULL, 'manopera', 'MAN-003', 'Fierar betonist', 'ora', 45, 'Preț orientativ' UNION ALL
  SELECT NULL, 'manopera', 'MAN-004', 'Dulgher', 'ora', 45, 'Preț orientativ' UNION ALL
  SELECT NULL, 'manopera', 'MAN-005', 'Muncitor necalificat', 'ora', 30, 'Preț orientativ' UNION ALL
  SELECT NULL, 'utilaj', 'UTL-001', 'Betonieră 250 l', 'ora', 15, 'Preț orientativ' UNION ALL
  SELECT NULL, 'utilaj', 'UTL-002', 'Pompă de beton', 'ora', 450, 'Preț orientativ' UNION ALL
  SELECT NULL, 'utilaj', 'UTL-003', 'Excavator pe pneuri 0,25-0,40 mc', 'ora', 220, 'Preț orientativ' UNION ALL
  SELECT NULL, 'transport', 'TRS-001', 'Autobasculantă 10 t', 'ora', 180, 'Preț orientativ' UNION ALL
  SELECT NULL, 'transport', 'TRS-002', 'Autocamion 5 t', 'ora', 140, 'Preț orientativ'
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM resources WHERE company_id IS NULL);
