-- 010: planuri de abonament și setări generale, editabile din panoul de admin
CREATE TABLE IF NOT EXISTS plans (
  id ENUM('start','pro','firma') NOT NULL,
  name VARCHAR(60) NOT NULL,
  monthly_price DECIMAL(10,2) NOT NULL,
  yearly_price DECIMAL(10,2) NOT NULL,
  max_users INT NOT NULL DEFAULT 1,
  features TEXT NOT NULL,
  highlighted TINYINT(1) NOT NULL DEFAULT 0,
  position INT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO plans (id, name, monthly_price, yearly_price, max_users, features, highlighted, position) VALUES
('start', 'Start', 99, 990, 1, 'Devize nelimitate\nExport Excel (F3, C5–C8)\nDeclarații precompletate\nBaze proprii de resurse', 0, 1),
('pro', 'Pro', 249, 2490, 3, 'Tot din Start\nAsistent AI: citire planuri DTAC / PTh, PDF, Excel\nCalcul manoperă și ore de regie\nCaiet de sarcini generat\nManagement de șantier', 1, 2),
('firma', 'Firmă', 499, 4990, 10, 'Tot din Pro\nRoluri și permisiuni\nSituații de lucrări lunare\nSuport prioritar', 0, 3);

CREATE TABLE IF NOT EXISTS settings (
  `key` VARCHAR(60) NOT NULL,
  `value` VARCHAR(255) NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO settings (`key`, `value`) VALUES
('trial_days', '14'),
('default_overhead_pct', '10'),
('default_profit_pct', '5'),
('default_vat_pct', '21');
