-- Cities still without a photo go to the end of "Browse by city", so the
-- rail opens with pictures. Only moves cities still at their seeded
-- position, so an order an admin has set is kept. Idempotent.
UPDATE "City" AS c SET "sortOrder" = p.new_order, "updatedAt" = CURRENT_TIMESTAMP
FROM (VALUES
  ('edinburgh', 100, 300),
  ('leicester', 110, 310),
  ('reading', 200, 320),
  ('luton', 220, 330),
  ('stoke-on-trent', 250, 340),
  ('oxford', 290, 350)
) AS p(slug, seeded, new_order)
WHERE c.slug = p.slug AND c."sortOrder" = p.seeded AND c."imageUrl" = '';
