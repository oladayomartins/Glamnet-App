-- Cities listed under "Browse by city", now managed by admins. Idempotent.

-- CreateTable
CREATE TABLE IF NOT EXISTS "City" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "outcode" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "imageFileId" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "City_slug_key" ON "City"("slug");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "City_name_key" ON "City"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "City_isActive_sortOrder_idx" ON "City"("isActive", "sortOrder");

-- Same posture as every other public table: RLS on, no policies.
ALTER TABLE "City" ENABLE ROW LEVEL SECURITY;

-- The launch list. Photographed cities first; admins reorder from there.
INSERT INTO "City" ("id", "slug", "name", "label", "outcode", "latitude", "longitude", "imageUrl", "sortOrder", "updatedAt") VALUES
  ('city_london', 'london', 'London', '', 'WC2N', 51.5072, -0.1283, 'https://ik.imagekit.io/glamnetapp/London%20City.png', 10, CURRENT_TIMESTAMP),
  ('city_birmingham', 'birmingham', 'Birmingham', '', 'B2', 52.4777, -1.898, 'https://ik.imagekit.io/glamnetapp/Birminigham%20City.png', 20, CURRENT_TIMESTAMP),
  ('city_manchester', 'manchester', 'Manchester', '', 'M2', 53.4793, -2.2446, 'https://ik.imagekit.io/glamnetapp/Manchester%20City.png', 30, CURRENT_TIMESTAMP),
  ('city_leeds', 'leeds', 'Leeds', '', 'LS1', 53.7951, -1.5467, 'https://ik.imagekit.io/glamnetapp/Leeds%20city.png', 40, CURRENT_TIMESTAMP),
  ('city_liverpool', 'liverpool', 'Liverpool', '', 'L1', 53.4064, -2.9789, 'https://ik.imagekit.io/glamnetapp/Liverpool%20city.png', 50, CURRENT_TIMESTAMP),
  ('city_sheffield', 'sheffield', 'Sheffield', '', 'S1', 53.3804, -1.4699, 'https://ik.imagekit.io/glamnetapp/Sheffield%20city.png', 60, CURRENT_TIMESTAMP),
  ('city_portsmouth', 'portsmouth', 'Portsmouth', '', 'PO1', 50.7973, -1.0913, 'https://ik.imagekit.io/glamnetapp/Portsmouth.png', 70, CURRENT_TIMESTAMP),
  ('city_glasgow', 'glasgow', 'Glasgow', '', 'G1', 55.8612, -4.2447, '', 80, CURRENT_TIMESTAMP),
  ('city_bristol', 'bristol', 'Bristol', '', 'BS1', 51.4517, -2.5969, '', 90, CURRENT_TIMESTAMP),
  ('city_edinburgh', 'edinburgh', 'Edinburgh', '', 'EH1', 55.9503, -3.193, '', 100, CURRENT_TIMESTAMP),
  ('city_leicester', 'leicester', 'Leicester', '', 'LE1', 52.635, -1.1372, '', 110, CURRENT_TIMESTAMP),
  ('city_coventry', 'coventry', 'Coventry', '', 'CV1', 52.4079, -1.5118, '', 120, CURRENT_TIMESTAMP),
  ('city_bradford', 'bradford', 'Bradford', '', 'BD1', 53.7923, -1.7533, '', 130, CURRENT_TIMESTAMP),
  ('city_cardiff', 'cardiff', 'Cardiff', '', 'CF10', 51.4758, -3.1792, '', 140, CURRENT_TIMESTAMP),
  ('city_belfast', 'belfast', 'Belfast', '', 'BT1', 54.5966, -5.9301, '', 150, CURRENT_TIMESTAMP),
  ('city_nottingham', 'nottingham', 'Nottingham', '', 'NG1', 52.9535, -1.1478, '', 160, CURRENT_TIMESTAMP),
  ('city_newcastle_upon_tyne', 'newcastle-upon-tyne', 'Newcastle upon Tyne', 'Newcastle', 'NE1', 54.9803, -1.6157, '', 170, CURRENT_TIMESTAMP),
  ('city_southampton', 'southampton', 'Southampton', '', 'SO14', 50.9078, -1.4043, '', 180, CURRENT_TIMESTAMP),
  ('city_brighton_and_hove', 'brighton-and-hove', 'Brighton and Hove', 'Brighton & Hove', 'BN1', 50.825, -0.1388, '', 190, CURRENT_TIMESTAMP),
  ('city_reading', 'reading', 'Reading', '', 'RG1', 51.4571, -0.9699, '', 200, CURRENT_TIMESTAMP),
  ('city_milton_keynes', 'milton-keynes', 'Milton Keynes', '', 'MK9', 52.0426, -0.758, '', 210, CURRENT_TIMESTAMP),
  ('city_luton', 'luton', 'Luton', '', 'LU1', 51.8817, -0.418, '', 220, CURRENT_TIMESTAMP),
  ('city_wolverhampton', 'wolverhampton', 'Wolverhampton', '', 'WV1', 52.586, -2.1293, '', 230, CURRENT_TIMESTAMP),
  ('city_derby', 'derby', 'Derby', '', 'DE1', 52.9243, -1.4888, '', 240, CURRENT_TIMESTAMP),
  ('city_stoke_on_trent', 'stoke-on-trent', 'Stoke-on-Trent', '', 'ST1', 53.0244, -2.1763, '', 250, CURRENT_TIMESTAMP),
  ('city_plymouth', 'plymouth', 'Plymouth', '', 'PL1', 50.3725, -4.1378, '', 260, CURRENT_TIMESTAMP),
  ('city_aberdeen', 'aberdeen', 'Aberdeen', '', 'AB10', 57.1496, -2.0969, '', 270, CURRENT_TIMESTAMP),
  ('city_cambridge', 'cambridge', 'Cambridge', '', 'CB2', 52.2048, 0.1193, '', 280, CURRENT_TIMESTAMP),
  ('city_oxford', 'oxford', 'Oxford', '', 'OX1', 51.7549, -1.2541, '', 290, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
