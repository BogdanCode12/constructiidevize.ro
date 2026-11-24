-- 022: textele văzute de clienți nu mai folosesc „AI” (decizia proprietarului) — „asistent tehnic” / „automat”.
-- Se aplică doar pe textele de pornire; ce a fost deja editat din admin rămâne cum e, cu excepția înlocuirilor punctuale.

UPDATE pages SET body = REPLACE(REPLACE(REPLACE(body,
  '## Cum ajută asistentul AI?', '## Cum ajută asistentul tehnic?'),
  'asistentul AI', 'asistentul tehnic'),
  'Asistentul AI', 'Asistentul tehnic');

UPDATE plans SET features = REPLACE(REPLACE(features,
  'Asistent AI: citire planuri DTAC / PTh, PDF, Excel', 'Asistent tehnic: citire planuri DTAC / PTh, PDF, Excel'),
  'Asistent AI', 'Asistent tehnic');

UPDATE ai_tasks SET name = 'Completare deviz din bază (automat)' WHERE slug = 'deviz_ai' AND name = 'Completare deviz din bază (AI)';
UPDATE ai_tasks SET description = REPLACE(description, 'AI-ul', 'Asistentul');
