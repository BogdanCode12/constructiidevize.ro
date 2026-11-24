-- 005: abonamente (unul activ per firmă); Stripe se leagă prin coloanele stripe_*
CREATE TABLE IF NOT EXISTS subscriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  plan ENUM('trial','start','pro','firma') NOT NULL DEFAULT 'trial',
  status ENUM('trialing','active','past_due','canceled','expired') NOT NULL DEFAULT 'trialing',
  billing_interval ENUM('month','year') NULL,
  trial_ends_at DATETIME NULL,
  current_period_end DATETIME NULL,
  stripe_customer_id VARCHAR(64) NULL,
  stripe_subscription_id VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subscriptions_company (company_id),
  KEY idx_subscriptions_stripe (stripe_subscription_id),
  CONSTRAINT fk_subscriptions_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
