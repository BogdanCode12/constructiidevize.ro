-- 016: rețete de articole, căutare FULLTEXT, cache de potriviri AI, text extras din documente

ALTER TABLE resources ADD FULLTEXT INDEX ft_resources (name, code);

CREATE TABLE IF NOT EXISTS recipes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NULL,          -- NULL = rețetă globală (catalogul platformei)
  code VARCHAR(40) NULL,
  name VARCHAR(500) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  norm_key VARCHAR(255) NOT NULL,           -- denumire + U.M. normalizate, pentru potrivire exactă
  source ENUM('manual','deviz','ai','import') NOT NULL DEFAULT 'deviz',
  uses INT NOT NULL DEFAULT 0,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_recipes_company_key (company_id, norm_key),
  KEY idx_recipes_code (code),
  FULLTEXT INDEX ft_recipes (name, code),
  CONSTRAINT fk_recipes_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recipe_resources (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  recipe_id BIGINT UNSIGNED NOT NULL,
  position INT NOT NULL DEFAULT 0,
  resource_id BIGINT UNSIGNED NULL,
  type ENUM('material','manopera','utilaj','transport','echipament') NOT NULL,
  code VARCHAR(40) NULL,
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  norm DECIMAL(16,6) NOT NULL DEFAULT 0,
  price DECIMAL(14,4) NOT NULL DEFAULT 0,   -- prețul la salvare; la folosire se ia prețul curent din resources
  PRIMARY KEY (id),
  KEY idx_rr_recipe (recipe_id, position),
  CONSTRAINT fk_rr_recipe FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE CASCADE,
  CONSTRAINT fk_rr_resource FOREIGN KEY (resource_id) REFERENCES resources (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Potriviri propuse de AI, refolosite ca să nu plătim de două ori pentru același articol.
CREATE TABLE IF NOT EXISTS ai_match_cache (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NULL,          -- NULL = folosește doar resurse globale, refolosibil de orice firmă
  norm_key VARCHAR(255) NOT NULL,
  proposal JSON NOT NULL,
  hits INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_match_cache (company_id, norm_key),
  KEY idx_match_key (norm_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE estimate_items ADD COLUMN review_note VARCHAR(255) NULL AFTER quantity;

ALTER TABLE project_files
  ADD COLUMN extracted_text MEDIUMTEXT NULL AFTER mime,
  ADD COLUMN extracted_pages INT NULL AFTER extracted_text;

ALTER TABLE ai_tasks ADD COLUMN send_originals TINYINT(1) NOT NULL DEFAULT 0 AFTER needs_files;

INSERT IGNORE INTO settings (`key`, `value`) VALUES
  ('ai_price_input_per_mtok', '4'),
  ('ai_price_output_per_mtok', '20');
