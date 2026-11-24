-- 030: numele comercial devine DevizConstruct.ro (sigla nouă, același domeniu devizconstruct.ro).
-- Textele editabile din admin care conțin vechiul nume se actualizează.

UPDATE pages SET title = REPLACE(title, 'DevizBuild', 'DevizConstruct'), body = REPLACE(body, 'DevizBuild', 'DevizConstruct')
 WHERE title LIKE '%DevizBuild%' OR body LIKE '%DevizBuild%';
UPDATE document_templates SET body = REPLACE(body, 'DevizBuild', 'DevizConstruct') WHERE body LIKE '%DevizBuild%';
UPDATE ai_tasks SET prompt = REPLACE(prompt, 'DevizBuild', 'DevizConstruct') WHERE prompt LIKE '%DevizBuild%';
UPDATE plans SET features = REPLACE(features, 'DevizBuild', 'DevizConstruct') WHERE features LIKE '%DevizBuild%';
