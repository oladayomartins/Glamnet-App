-- Photos for sixteen more cities. Only fills cities that have no photo yet,
-- so a photo an admin has already set is never overwritten. Idempotent.
UPDATE "City" AS c SET "imageUrl" = p.url, "updatedAt" = CURRENT_TIMESTAMP
FROM (VALUES
  ('newcastle-upon-tyne', 'https://ik.imagekit.io/glamnetapp/Newcastle.png'),
  ('southampton', 'https://ik.imagekit.io/glamnetapp/Southampton.png'),
  ('brighton-and-hove', 'https://ik.imagekit.io/glamnetapp/Brighton.png'),
  ('derby', 'https://ik.imagekit.io/glamnetapp/Derby.png'),
  ('milton-keynes', 'https://ik.imagekit.io/glamnetapp/Miltoon%20Keynes.png'),
  ('wolverhampton', 'https://ik.imagekit.io/glamnetapp/Wolverhampton.png'),
  ('aberdeen', 'https://ik.imagekit.io/glamnetapp/Aberdeen.png'),
  ('cambridge', 'https://ik.imagekit.io/glamnetapp/Cambridge.png'),
  ('plymouth', 'https://ik.imagekit.io/glamnetapp/Plymouth.png'),
  ('nottingham', 'https://ik.imagekit.io/glamnetapp/Nottingham.png'),
  ('cardiff', 'https://ik.imagekit.io/glamnetapp/Caddiff.png'),
  ('belfast', 'https://ik.imagekit.io/glamnetapp/Belfast.png'),
  ('bradford', 'https://ik.imagekit.io/glamnetapp/Bradford.png'),
  ('glasgow', 'https://ik.imagekit.io/glamnetapp/Glasgow.png'),
  ('bristol', 'https://ik.imagekit.io/glamnetapp/Bristol.png'),
  ('coventry', 'https://ik.imagekit.io/glamnetapp/Coventry.png')
) AS p(slug, url)
WHERE c.slug = p.slug AND c."imageUrl" = '';
