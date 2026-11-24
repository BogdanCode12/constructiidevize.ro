-- 011: echipamente tehnologice (pentru F4/C9), date pentru graficul de execuție
ALTER TABLE resources
  MODIFY type ENUM('material','manopera','utilaj','transport','echipament') NOT NULL;

ALTER TABLE estimate_item_resources
  MODIFY type ENUM('material','manopera','utilaj','transport','echipament') NOT NULL;

ALTER TABLE estimates
  ADD COLUMN start_date DATE NULL AFTER vat_pct,
  ADD COLUMN hours_per_day DECIMAL(4,1) NOT NULL DEFAULT 8 AFTER start_date;

ALTER TABLE estimate_chapters
  ADD COLUMN team_size INT NOT NULL DEFAULT 4 AFTER name,
  ADD COLUMN start_day INT NULL AFTER team_size;
