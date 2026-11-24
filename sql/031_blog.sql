-- 031: Noutăți (blog despre construcții) — articole scrise din admin, cu câmpuri SEO.

CREATE TABLE IF NOT EXISTS posts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(190) NOT NULL,
  title VARCHAR(255) NOT NULL,
  excerpt VARCHAR(500) NULL,              -- rezumat (listă, rețele sociale, descriere implicită)
  body MEDIUMTEXT NOT NULL,               -- Markdown
  cover_url VARCHAR(500) NULL,            -- imaginea principală (încărcată în /media/blog/…)
  cover_alt VARCHAR(255) NULL,
  category VARCHAR(80) NULL,
  tags VARCHAR(255) NULL,                 -- separate prin virgulă
  meta_title VARCHAR(190) NULL,           -- titlul pentru Google (implicit: titlul)
  meta_description VARCHAR(300) NULL,     -- descrierea pentru Google (implicit: rezumatul)
  author_name VARCHAR(120) NULL,
  status ENUM('draft','publicat') NOT NULL DEFAULT 'draft',
  published_at DATETIME NULL,
  views INT UNSIGNED NOT NULL DEFAULT 0,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_posts_slug (slug),
  KEY idx_posts_status (status, published_at),
  KEY idx_posts_category (category),
  CONSTRAINT fk_posts_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
