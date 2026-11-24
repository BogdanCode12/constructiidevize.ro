-- 025: Articole & Norme — status, sursa normei, versiuni, pierderi tehnologice
--
-- Rețetele (articol → resurse + consumuri) primesc:
--   status: draft (nevalidată) / verificat / depasit (înlocuită de o versiune nouă sau scoasă din uz)
--   sursa și versiunea normei, condițiile de aplicare, cine și când a verificat-o
--   versiuni: o rețetă verificată nu se modifică pe loc; modificarea creează o versiune nouă (previous_id),
--             iar la verificarea ei versiunea veche devine „depasit” (superseded_by).
-- Pierderile tehnologice (%) se păstrează separat de consum, pe rețetă și în deviz:
--   cantitate resursă = cantitate articol × consum × (1 + pierderi/100).

ALTER TABLE recipes
  ADD COLUMN category VARCHAR(80) NULL AFTER unit,
  ADD COLUMN description TEXT NULL AFTER category,
  ADD COLUMN status ENUM('draft','verificat','depasit') NOT NULL DEFAULT 'draft' AFTER description,
  ADD COLUMN norm_source VARCHAR(190) NULL AFTER status,
  ADD COLUMN norm_version VARCHAR(60) NULL AFTER norm_source,
  ADD COLUMN conditions VARCHAR(500) NULL AFTER norm_version,
  ADD COLUMN verified_at DATETIME NULL AFTER conditions,
  ADD COLUMN verified_by BIGINT UNSIGNED NULL AFTER verified_at,
  ADD COLUMN version INT NOT NULL DEFAULT 1 AFTER verified_by,
  ADD COLUMN previous_id BIGINT UNSIGNED NULL AFTER version,
  ADD COLUMN superseded_by BIGINT UNSIGNED NULL AFTER previous_id,
  ADD KEY idx_recipes_status (status, superseded_by),
  ADD KEY idx_recipes_category (category);

ALTER TABLE recipe_resources
  ADD COLUMN waste_pct DECIMAL(6,2) NOT NULL DEFAULT 0 AFTER norm,
  ADD COLUMN note VARCHAR(255) NULL AFTER price;

ALTER TABLE estimate_item_resources
  ADD COLUMN waste_pct DECIMAL(6,2) NOT NULL DEFAULT 0 AFTER norm;

-- Rețetele salvate până acum de utilizatori din editor (★) au fost confirmate de ei → verificate.
-- Cele propuse automat sau importate rămân draft.
UPDATE recipes SET status = 'verificat', verified_at = updated_at, verified_by = created_by
 WHERE source IN ('deviz', 'manual');

-- Articole uzuale, ca punct de pornire: DOAR denumirea și U.M., în draft, fără consumuri.
-- Consumurile se completează din admin, din surse tehnice verificate.
INSERT INTO recipes (company_id, name, unit, category, norm_key, source, status)
SELECT NULL, s.name, s.unit, s.category, s.norm_key, 'manual', 'draft' FROM (
  SELECT 'Săpătură manuală în pământ, adâncime până la 1,5 m' AS name, 'mc' AS unit, 'Terasamente' AS category, 'sapatura manuala in pamant adancime pana la 1.5 m|mc' AS norm_key UNION ALL
  SELECT 'Săpătură mecanizată cu excavatorul, cu încărcare în autovehicul', 'mc', 'Terasamente', 'sapatura mecanizata cu excavatorul cu incarcare in autovehicul|mc' UNION ALL
  SELECT 'Umplutură din pământ compactată în straturi', 'mc', 'Terasamente', 'umplutura din pamant compactata in straturi|mc' UNION ALL
  SELECT 'Transport pământ cu autobasculanta', 't', 'Terasamente', 'transport pamant cu autobasculanta|t' UNION ALL
  SELECT 'Beton simplu de egalizare C8/10', 'mc', 'Beton', 'beton simplu de egalizare c8/10|mc' UNION ALL
  SELECT 'Beton armat în fundații C20/25, turnat cu pompa', 'mc', 'Beton', 'beton armat in fundatii c20/25 turnat cu pompa|mc' UNION ALL
  SELECT 'Beton armat în stâlpi și grinzi C25/30', 'mc', 'Beton', 'beton armat in stalpi si grinzi c25/30|mc' UNION ALL
  SELECT 'Beton armat în plăci C25/30', 'mc', 'Beton', 'beton armat in placi c25/30|mc' UNION ALL
  SELECT 'Armătură din oțel beton B500C, diametre până la 12 mm', 'kg', 'Armături', 'armatura din otel beton b500c diametre pana la 12 mm|kg' UNION ALL
  SELECT 'Armătură din oțel beton B500C, diametre peste 12 mm', 'kg', 'Armături', 'armatura din otel beton b500c diametre peste 12 mm|kg' UNION ALL
  SELECT 'Plasă sudată pentru armare', 'kg', 'Armături', 'plasa sudata pentru armare|kg' UNION ALL
  SELECT 'Cofraj din panouri refolosibile pentru fundații', 'mp', 'Cofraje', 'cofraj din panouri refolosibile pentru fundatii|mp' UNION ALL
  SELECT 'Cofraj pentru stâlpi și grinzi', 'mp', 'Cofraje', 'cofraj pentru stalpi si grinzi|mp' UNION ALL
  SELECT 'Cofraj pentru plăci', 'mp', 'Cofraje', 'cofraj pentru placi|mp' UNION ALL
  SELECT 'Zidărie din blocuri ceramice cu goluri, 25 cm', 'mc', 'Zidărie', 'zidarie din blocuri ceramice cu goluri 25 cm|mc' UNION ALL
  SELECT 'Zidărie din BCA, 25 cm, cu adeziv', 'mc', 'Zidărie', 'zidarie din bca 25 cm cu adeziv|mc' UNION ALL
  SELECT 'Zidărie din bolțari de beton', 'mp', 'Zidărie', 'zidarie din boltari de beton|mp' UNION ALL
  SELECT 'Tencuială interioară driscuită pe pereți', 'mp', 'Tencuieli', 'tencuiala interioara driscuita pe pereti|mp' UNION ALL
  SELECT 'Tencuială exterioară pe fațade', 'mp', 'Tencuieli', 'tencuiala exterioara pe fatade|mp' UNION ALL
  SELECT 'Glet de ipsos pe pereți și tavane', 'mp', 'Tencuieli', 'glet de ipsos pe pereti si tavane|mp' UNION ALL
  SELECT 'Zugrăveli lavabile interioare, două straturi', 'mp', 'Zugrăveli', 'zugraveli lavabile interioare doua straturi|mp' UNION ALL
  SELECT 'Vopsitorie lavabilă exterioară', 'mp', 'Zugrăveli', 'vopsitorie lavabila exterioara|mp' UNION ALL
  SELECT 'Termosistem din polistiren expandat, 10 cm', 'mp', 'Termoizolații', 'termosistem din polistiren expandat 10 cm|mp' UNION ALL
  SELECT 'Termosistem din vată minerală bazaltică, 10 cm', 'mp', 'Termoizolații', 'termosistem din vata minerala bazaltica 10 cm|mp' UNION ALL
  SELECT 'Termoizolație planșeu pod cu vată minerală', 'mp', 'Termoizolații', 'termoizolatie planseu pod cu vata minerala|mp'
) AS s
WHERE NOT EXISTS (SELECT 1 FROM recipes r WHERE r.company_id IS NULL AND r.norm_key = s.norm_key);
