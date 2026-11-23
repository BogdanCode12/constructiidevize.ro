-- 018: execuție / șantier — situații de lucrări, financiar proiect, subcontractanți, jurnal de șantier

ALTER TABLE projects
  ADD COLUMN contract_estimate_id BIGINT UNSIGNED NULL AFTER notes,
  ADD COLUMN contract_value DECIMAL(16,2) NULL AFTER contract_estimate_id,
  ADD COLUMN contract_date DATE NULL AFTER contract_value;

CREATE TABLE IF NOT EXISTS work_situations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  project_id BIGINT UNSIGNED NOT NULL,
  estimate_id BIGINT UNSIGNED NULL,
  number INT NOT NULL,
  period_from DATE NULL,
  period_to DATE NULL,
  status ENUM('ciorna','emisa','acceptata','incasata') NOT NULL DEFAULT 'ciorna',
  vat_pct DECIMAL(6,2) NOT NULL DEFAULT 21,
  notes VARCHAR(500) NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_situation_number (project_id, number),
  CONSTRAINT fk_ws_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_ws_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Liniile sunt o copie a articolelor din deviz la momentul creării (devizul se poate modifica ulterior).
CREATE TABLE IF NOT EXISTS work_situation_lines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  situation_id BIGINT UNSIGNED NOT NULL,
  position INT NOT NULL,
  item_key VARCHAR(300) NOT NULL,          -- identifică articolul între situații (cod + denumire + U.M. normalizate)
  chapter VARCHAR(255) NOT NULL,
  code VARCHAR(40) NULL,
  name VARCHAR(500) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  qty_contract DECIMAL(16,4) NOT NULL DEFAULT 0,
  unit_price DECIMAL(16,4) NOT NULL DEFAULT 0,   -- preț unitar de ofertă (cu indirecte și profit), fără TVA
  qty_current DECIMAL(16,4) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_wsl_situation (situation_id, position),
  KEY idx_wsl_key (item_key(100)),
  CONSTRAINT fk_wsl_situation FOREIGN KEY (situation_id) REFERENCES work_situations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subcontractors (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(190) NOT NULL,
  cui VARCHAR(20) NULL,
  specialty VARCHAR(190) NULL,
  contact VARCHAR(120) NULL,
  phone VARCHAR(40) NULL,
  email VARCHAR(190) NULL,
  notes VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_subc_company (company_id),
  CONSTRAINT fk_subc_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_subcontracts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  subcontractor_id BIGINT UNSIGNED NOT NULL,
  scope VARCHAR(500) NOT NULL,
  value DECIMAL(16,2) NOT NULL DEFAULT 0,
  status ENUM('ofertat','contractat','in_lucru','finalizat') NOT NULL DEFAULT 'contractat',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_psub_project (project_id),
  CONSTRAINT fk_psub_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_psub_sub FOREIGN KEY (subcontractor_id) REFERENCES subcontractors (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  project_id BIGINT UNSIGNED NOT NULL,
  kind ENUM('incasare','cheltuiala') NOT NULL,
  category ENUM('situatie','avans','materiale','manopera','utilaje','transport','subcontractare','alte') NOT NULL DEFAULT 'alte',
  amount DECIMAL(16,2) NOT NULL,              -- fără TVA
  tx_date DATE NOT NULL,
  description VARCHAR(255) NULL,
  document_no VARCHAR(60) NULL,
  subcontractor_id BIGINT UNSIGNED NULL,
  situation_id BIGINT UNSIGNED NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tx_project (project_id, tx_date),
  CONSTRAINT fk_tx_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_tx_sub FOREIGN KEY (subcontractor_id) REFERENCES subcontractors (id) ON DELETE SET NULL,
  CONSTRAINT fk_tx_situation FOREIGN KEY (situation_id) REFERENCES work_situations (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_journal (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  project_id BIGINT UNSIGNED NOT NULL,
  entry_date DATE NOT NULL,
  weather VARCHAR(80) NULL,
  workers INT NULL,
  hours DECIMAL(8,2) NULL,
  activities TEXT NULL,
  issues TEXT NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_journal_project (project_id, entry_date),
  CONSTRAINT fk_journal_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_photos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  journal_id BIGINT UNSIGNED NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime VARCHAR(120) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_photos_journal (journal_id),
  CONSTRAINT fk_photos_journal FOREIGN KEY (journal_id) REFERENCES site_journal (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
