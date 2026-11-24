-- 023: formulare fără „AI” în politica de confidențialitate (informarea despre furnizorul modelului rămâne).
UPDATE pages SET body = REPLACE(body,
  'când folosești funcțiile AI, documentele și întrebările relevante sunt trimise către Anthropic (furnizorul modelului Claude), doar pentru a genera răspunsul.',
  'când folosești asistentul tehnic, documentele și întrebările relevante sunt trimise către Anthropic (furnizorul modelului de limbaj Claude), doar pentru a genera răspunsul.')
WHERE slug = 'confidentialitate';
