-- Prescription attachments: jpeg / png / pdf files attached to a prescription.
-- Stored on Cloudinary; we keep url + public_id + metadata in the DB.

CREATE TABLE "prescription_attachments" (
  "id"             TEXT NOT NULL,
  "prescriptionId" TEXT NOT NULL,
  "clinicId"       TEXT NOT NULL,
  "uploadedById"   TEXT,
  "url"            TEXT NOT NULL,
  "publicId"       TEXT,
  "filename"       TEXT NOT NULL,
  "mimeType"       TEXT NOT NULL,
  "sizeBytes"      INTEGER NOT NULL DEFAULT 0,
  "resourceType"   TEXT NOT NULL DEFAULT 'image',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prescription_attachments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "prescription_attachments"
  ADD CONSTRAINT "prescription_attachments_prescriptionId_fkey"
  FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE CASCADE;

ALTER TABLE "prescription_attachments"
  ADD CONSTRAINT "prescription_attachments_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE;

ALTER TABLE "prescription_attachments"
  ADD CONSTRAINT "prescription_attachments_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL;

CREATE INDEX "prescription_attachments_prescriptionId_idx"
  ON "prescription_attachments"("prescriptionId");
CREATE INDEX "prescription_attachments_clinicId_idx"
  ON "prescription_attachments"("clinicId");
