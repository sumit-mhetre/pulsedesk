-- Doctor Data Privacy: per-clinic toggles + per-row owner tagging.
-- All toggles default false (privacy-first). Existing rows have userId NULL,
-- which the application treats as "legacy shared - visible to everyone."

ALTER TABLE "clinics"
  ADD COLUMN "shareAppointments"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sharePrescriptions" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "shareTemplates"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "shareMasterData"    BOOLEAN NOT NULL DEFAULT false;

-- userId on the personal-workflow tables. Nullable on purpose: existing rows
-- get NULL (= legacy shared) and brand-new rows are stamped with the creator.
ALTER TABLE "prescription_templates" ADD COLUMN "userId" TEXT;
ALTER TABLE "complaints"             ADD COLUMN "userId" TEXT;
ALTER TABLE "diagnoses"              ADD COLUMN "userId" TEXT;
ALTER TABLE "advice_options"         ADD COLUMN "userId" TEXT;

-- Foreign keys -> users(id). ON DELETE SET NULL so when a doctor is removed
-- their workflow data falls back to "legacy shared" instead of disappearing.
ALTER TABLE "prescription_templates"
  ADD CONSTRAINT "prescription_templates_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "complaints"
  ADD CONSTRAINT "complaints_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "diagnoses"
  ADD CONSTRAINT "diagnoses_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "advice_options"
  ADD CONSTRAINT "advice_options_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL;

-- Drop the old (clinicId, name) unique INDEXES and replace with composite
-- that includes userId, so two doctors can have their own "URTI 1" template.
-- These were created by Prisma as unique indexes, not table constraints, so we
-- DROP INDEX (not DROP CONSTRAINT). Postgres lets multiple rows have NULL in
-- the userId slot, so legacy shared rows still keep their old name uniqueness.
DROP INDEX "prescription_templates_clinicId_name_key";
DROP INDEX "complaints_clinicId_nameEn_key";
DROP INDEX "diagnoses_clinicId_nameEn_key";
DROP INDEX "advice_options_clinicId_nameEn_key";

ALTER TABLE "prescription_templates"
  ADD CONSTRAINT "prescription_templates_clinicId_userId_name_key"
  UNIQUE ("clinicId", "userId", "name");

ALTER TABLE "complaints"
  ADD CONSTRAINT "complaints_clinicId_userId_nameEn_key"
  UNIQUE ("clinicId", "userId", "nameEn");

ALTER TABLE "diagnoses"
  ADD CONSTRAINT "diagnoses_clinicId_userId_nameEn_key"
  UNIQUE ("clinicId", "userId", "nameEn");

ALTER TABLE "advice_options"
  ADD CONSTRAINT "advice_options_clinicId_userId_nameEn_key"
  UNIQUE ("clinicId", "userId", "nameEn");

-- Indexes for the new filter pattern (clinicId + userId).
CREATE INDEX "prescription_templates_clinicId_userId_idx" ON "prescription_templates"("clinicId", "userId");
CREATE INDEX "complaints_clinicId_userId_idx"             ON "complaints"("clinicId", "userId");
CREATE INDEX "diagnoses_clinicId_userId_idx"              ON "diagnoses"("clinicId", "userId");
CREATE INDEX "advice_options_clinicId_userId_idx"         ON "advice_options"("clinicId", "userId");

