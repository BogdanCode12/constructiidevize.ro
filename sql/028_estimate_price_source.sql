-- 028: sursa prețului fiecărei resurse din deviz (pentru verificări și actualizări controlate)
--   price_offer_id: oferta din catalog cu care a fost preluat prețul (valabilitate, status, furnizor)
--   price_manual:   prețul a fost introdus manual în deviz (nu se actualizează automat din catalog)

ALTER TABLE estimate_item_resources
  ADD COLUMN price_offer_id BIGINT UNSIGNED NULL AFTER price,
  ADD COLUMN price_manual TINYINT(1) NOT NULL DEFAULT 0 AFTER price_offer_id;
