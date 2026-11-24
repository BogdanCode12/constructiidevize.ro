-- 012: dosarul firmei, invitații, termene de proiect, șabloane de declarații, jurnal alerte

ALTER TABLE companies
  ADD COLUMN legal_rep VARCHAR(120) NULL AFTER phone,
  ADD COLUMN legal_rep_role VARCHAR(80) NULL AFTER legal_rep,
  ADD COLUMN email VARCHAR(190) NULL AFTER legal_rep_role,
  ADD COLUMN iban VARCHAR(40) NULL AFTER email,
  ADD COLUMN bank VARCHAR(120) NULL AFTER iban,
  ADD COLUMN caen VARCHAR(10) NULL AFTER bank;

ALTER TABLE projects
  ADD COLUMN authority VARCHAR(190) NULL AFTER client_name,
  ADD COLUMN notice_number VARCHAR(60) NULL AFTER authority,
  ADD COLUMN notes TEXT NULL AFTER location;

CREATE TABLE IF NOT EXISTS company_documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  category ENUM('certificat','autorizatie','experienta','personal','utilaj','financiar','altele') NOT NULL DEFAULT 'altele',
  title VARCHAR(255) NOT NULL,
  issuer VARCHAR(190) NULL,
  doc_number VARCHAR(80) NULL,
  issued_at DATE NULL,
  expires_at DATE NULL,
  notes VARCHAR(500) NULL,
  file_path VARCHAR(255) NULL,
  file_name VARCHAR(255) NULL,
  file_size INT UNSIGNED NULL,
  mime VARCHAR(120) NULL,
  uploaded_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_cdocs_company (company_id, category),
  KEY idx_cdocs_expires (expires_at),
  CONSTRAINT fk_cdocs_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE,
  CONSTRAINT fk_cdocs_user FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invitations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  email VARCHAR(190) NOT NULL,
  role ENUM('admin','member') NOT NULL DEFAULT 'member',
  token_hash CHAR(64) NOT NULL,
  invited_by BIGINT UNSIGNED NULL,
  expires_at DATETIME NOT NULL,
  accepted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invitations_token (token_hash),
  KEY idx_invitations_company (company_id),
  CONSTRAINT fk_invitations_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_deadlines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  type ENUM('depunere','clarificari','deschidere','garantie','contract','executie','altul') NOT NULL DEFAULT 'altul',
  title VARCHAR(190) NOT NULL,
  due_at DATETIME NOT NULL,
  done TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_deadlines_project (project_id),
  KEY idx_deadlines_due (due_at),
  CONSTRAINT fk_deadlines_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS alert_log (
  alert_key VARCHAR(120) NOT NULL,
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (alert_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS document_templates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(190) NOT NULL,
  category VARCHAR(60) NOT NULL DEFAULT 'Declarații',
  body MEDIUMTEXT NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  position INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
