-- 029: datele originale ale articolului din F3-ul autorității (Modul licitație): cod, denumire, U.M., cantitate.
-- Nu se modifică automat; verificatorul semnalează orice diferență față de ele.

ALTER TABLE estimate_items
  ADD COLUMN f3_ref JSON NULL AFTER qty_estimated;
