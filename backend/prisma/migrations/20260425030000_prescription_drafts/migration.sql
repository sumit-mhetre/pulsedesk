-- PrescriptionDraft - in-flight autosave snapshots
CREATE TABLE "prescription_drafts" (
    "id"         TEXT NOT NULL,
    "clinicId"   TEXT NOT NULL,
    "doctorId"   TEXT NOT NULL,
    "patientId"  TEXT NOT NULL,
    "formState"  JSONB NOT NULL,
    "version"    INTEGER NOT NULL DEFAULT 1,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescription_drafts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "prescription_drafts_doctorId_patientId_key"
  ON "prescription_drafts"("doctorId", "patientId");

CREATE INDEX "prescription_drafts_clinicId_updatedAt_idx"
  ON "prescription_drafts"("clinicId", "updatedAt");
