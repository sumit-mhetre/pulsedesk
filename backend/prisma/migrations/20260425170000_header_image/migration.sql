-- Header image (full-width banner) for clinics
ALTER TABLE "clinics"
  ADD COLUMN "headerImageUrl"   TEXT,
  ADD COLUMN "hideTextOnHeader" BOOLEAN NOT NULL DEFAULT true;
