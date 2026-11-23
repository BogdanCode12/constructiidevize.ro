-- 006: proiecte (lucrări / licitații) — baza pentru devize, șantier, documente
CREATE TABLE IF NOT EXISTS projects (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(190) NOT NULL,
  client_name VARCHAR(190) NULL,
  location VARCHAR(190) NULL,
  status ENUM('ofertare','licitatie','in_executie','finalizat','anulat') NOT NULL DEFAULT 'ofertare',
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_projects_company (company_id, status),
  CONSTRAINT fk_projects_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE,
  CONSTRAINT fk_projects_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
