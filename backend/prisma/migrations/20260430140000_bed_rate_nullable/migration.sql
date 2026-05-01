-- Make bed dailyRate nullable. Previously NOT NULL because we expected Super
-- Admin to set it during bed creation. New flow: Super Admin only sets up
-- bed inventory (type/ward/floor); clinic admin sets daily rate later via
-- the Bed Management page. Existing beds keep their rate (no data change).

ALTER TABLE "beds" ALTER COLUMN "dailyRate" DROP NOT NULL;
ALTER TABLE "beds" ALTER COLUMN "dailyRate" SET DEFAULT 0;
