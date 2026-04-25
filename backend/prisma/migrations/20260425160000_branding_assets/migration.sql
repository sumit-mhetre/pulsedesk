-- Branding image fields for clinics and doctors
ALTER TABLE "clinics"
  ADD COLUMN "footerImageUrl" TEXT,
  ADD COLUMN "letterheadUrl"  TEXT,
  ADD COLUMN "letterheadMode" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "users"
  ADD COLUMN "stamp" TEXT;
