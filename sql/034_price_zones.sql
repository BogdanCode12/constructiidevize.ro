-- Prețuri pe zone: o ofertă poate fi valabilă într-un județ (cod auto: BZ, BC, B…) sau în toată țara (NULL).
-- Devizul are o zonă de prețuri (județul lucrării); prețul se alege: propriu județ → propriu regiune → propriu național
-- → catalog județ → catalog regiune → preț de referință (național).
ALTER TABLE resource_prices ADD COLUMN IF NOT EXISTS county VARCHAR(3) NULL AFTER company_id;
ALTER TABLE resource_prices ADD KEY IF NOT EXISTS idx_rp_county (resource_id, county);
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS price_county VARCHAR(3) NULL AFTER rules_date;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS county VARCHAR(3) NULL AFTER location;
