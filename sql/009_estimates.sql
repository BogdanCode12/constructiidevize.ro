-- 009: devize (pe proiect) → capitole → articole → resursele articolului
CREATE TABLE IF NOT EXISTS estimates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  project_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(190) NOT NULL,
  overhead_pct DECIMAL(6,2) NOT NULL DEFAULT 10,
  profit_pct DECIMAL(6,2) NOT NULL DEFAULT 5,
  vat_pct DECIMAL(6,2) NOT NULL DEFAULT 21,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_estimates_company (company_id),
  KEY idx_estimates_project (project_id),
  CONSTRAINT fk_estimates_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE,
  CONSTRAINT fk_estimates_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_estimates_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS estimate_chapters (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  estimate_id BIGINT UNSIGNED NOT NULL,
  position INT NOT NULL DEFAULT 0,
  name VARCHAR(255) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_chapters_estimate (estimate_id, position),
  CONSTRAINT fk_chapters_estimate FOREIGN KEY (estimate_id) REFERENCES estimates (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS estimate_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  chapter_id BIGINT UNSIGNED NOT NULL,
  position INT NOT NULL DEFAULT 0,
  code VARCHAR(40) NULL,
  name VARCHAR(500) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  quantity DECIMAL(16,4) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_items_chapter (chapter_id, position),
  CONSTRAINT fk_items_chapter FOREIGN KEY (chapter_id) REFERENCES estimate_chapters (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Resursele unui articol: consum (normă) pe unitatea articolului × preț.
-- Denumirea și prețul sunt copiate din catalog, ca devizul să nu se schimbe când se schimbă catalogul.
CREATE TABLE IF NOT EXISTS estimate_item_resources (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_id BIGINT UNSIGNED NOT NULL,
  position INT NOT NULL DEFAULT 0,
  resource_id BIGINT UNSIGNED NULL,
  type ENUM('material','manopera','utilaj','transport') NOT NULL,
  code VARCHAR(40) NULL,
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  norm DECIMAL(16,6) NOT NULL DEFAULT 0,
  price DECIMAL(14,4) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_ir_item (item_id, position),
  CONSTRAINT fk_ir_item FOREIGN KEY (item_id) REFERENCES estimate_items (id) ON DELETE CASCADE,
  CONSTRAINT fk_ir_resource FOREIGN KEY (resource_id) REFERENCES resources (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
