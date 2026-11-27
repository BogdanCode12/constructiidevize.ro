-- Jurnalul e-mailurilor trimise (vizibil în admin → Setări), ca să se vadă dacă SMTP-ul merge.
CREATE TABLE IF NOT EXISTS email_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  to_email VARCHAR(190) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  kind VARCHAR(40) NOT NULL DEFAULT 'altul',
  status ENUM('trimis','eroare','consola') NOT NULL,
  error VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_email_log_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
