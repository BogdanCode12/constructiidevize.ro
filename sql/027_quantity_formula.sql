-- 027: „Cum s-a calculat?” — formula cantității pe articol, sursa dimensiunilor și ipotezele
--   qty_formula:   ex. „30[lungime gard] × 0,40[lățime] × 0,80[adâncime]” → cantitatea se calculează din ea
--   qty_note:      sursa datelor / ipotezele (ex. „din planșa A-02, cota fundației”)
--   qty_estimated: cantitate estimată (date insuficiente) — rămâne marcată „necesită verificare”

ALTER TABLE estimate_items
  ADD COLUMN qty_formula VARCHAR(500) NULL AFTER quantity,
  ADD COLUMN qty_note VARCHAR(1000) NULL AFTER qty_formula,
  ADD COLUMN qty_estimated TINYINT(1) NOT NULL DEFAULT 0 AFTER qty_note;
