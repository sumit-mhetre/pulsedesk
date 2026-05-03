-- Medical Documents (fitness certs, medical certs, referrals)

CREATE TYPE "DocType" AS ENUM ('FITNESS_CERT', 'MEDICAL_CERT', 'REFERRAL');

CREATE TABLE "medical_documents" (
    "id"              TEXT NOT NULL,
    "clinicId"        TEXT NOT NULL,
    "docNo"           TEXT NOT NULL,
    "type"            "DocType" NOT NULL,
    "doctorId"        TEXT NOT NULL,
    "patientId"       TEXT NOT NULL,
    "patientName"     TEXT NOT NULL,
    "patientAge"      INTEGER,
    "patientGender"   "Gender",
    "patientGuardian" TEXT,
    "patientEmpId"    TEXT,
    "patientAddress"  TEXT,
    "patientPhone"    TEXT,
    "examDate"        TIMESTAMP(3) NOT NULL,
    "diagnosis"       TEXT,
    "remarks"         TEXT,
    "data"            JSONB NOT NULL DEFAULT '{}',
    "templateUsed"    TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "medical_documents_clinicId_docNo_key"
  ON "medical_documents"("clinicId", "docNo");
CREATE INDEX "medical_documents_clinicId_type_createdAt_idx"
  ON "medical_documents"("clinicId", "type", "createdAt");
CREATE INDEX "medical_documents_patientId_createdAt_idx"
  ON "medical_documents"("patientId", "createdAt");

ALTER TABLE "medical_documents"
  ADD CONSTRAINT "medical_documents_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "medical_documents"
  ADD CONSTRAINT "medical_documents_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "medical_documents"
  ADD CONSTRAINT "medical_documents_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Templates
CREATE TABLE "medical_document_templates" (
    "id"        TEXT NOT NULL,
    "clinicId"  TEXT NOT NULL,
    "type"      "DocType" NOT NULL,
    "name"      TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "diagnosis" TEXT,
    "remarks"   TEXT,
    "data"      JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_document_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "medical_document_templates_clinicId_type_name_key"
  ON "medical_document_templates"("clinicId", "type", "name");
CREATE INDEX "medical_document_templates_clinicId_type_idx"
  ON "medical_document_templates"("clinicId", "type");

ALTER TABLE "medical_document_templates"
  ADD CONSTRAINT "medical_document_templates_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default document templates for ALL existing clinics (idempotent - only inserts if not present)
INSERT INTO "medical_document_templates" ("id", "clinicId", "type", "name", "isDefault", "diagnosis", "remarks", "data", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  c.id,
  t.type::"DocType",
  t.name,
  t."isDefault",
  t.diagnosis,
  t.remarks,
  t.data::jsonb,
  NOW(),
  NOW()
FROM "clinics" c
CROSS JOIN (VALUES
  ('FITNESS_CERT', 'General fitness - Employment', TRUE,
   'No abnormality detected on physical examination.', '',
   '{"verdict":"FIT","fitnessFor":"Employment","validityMonths":6,"vitals":{}}'),
  ('FITNESS_CERT', 'Pre-employment fitness', FALSE,
   'Patient is in good general health.',
   'Recommended for office / desk-based roles.',
   '{"verdict":"FIT","fitnessFor":"Pre-employment","validityMonths":12,"vitals":{}}'),
  ('FITNESS_CERT', 'Sports fitness - adult', FALSE,
   'Cardiovascular and musculoskeletal exam normal.', '',
   '{"verdict":"FIT","fitnessFor":"Sports","validityMonths":6,"vitals":{}}'),
  ('MEDICAL_CERT', 'Viral fever - 3 days rest', TRUE,
   'Viral fever with body ache and headache',
   'Patient advised bed rest, plenty of fluids, and prescribed medication.',
   '{"defaultRestDays":3}'),
  ('MEDICAL_CERT', 'Acute gastroenteritis - 2 days', FALSE,
   'Acute gastroenteritis',
   'Patient advised oral rehydration, light diet, and prescribed medication.',
   '{"defaultRestDays":2}'),
  ('MEDICAL_CERT', 'Migraine / severe headache - 1 day', FALSE,
   'Acute migraine',
   'Patient advised rest in a quiet, darkened environment.',
   '{"defaultRestDays":1}'),
  ('REFERRAL', 'Cardiology referral', TRUE,
   '', 'Thanking you for your assistance.',
   '{"referredToSpecialty":"Cardiologist","reasonForReferral":"Patient presents with chest pain / palpitations requiring specialist evaluation. Kindly advise further management."}'),
  ('REFERRAL', 'Orthopedic referral', FALSE,
   '', 'Thanking you.',
   '{"referredToSpecialty":"Orthopedic Surgeon","reasonForReferral":"Patient with persistent musculoskeletal complaints. Kindly advise further management."}')
) AS t(type, name, "isDefault", diagnosis, remarks, data)
ON CONFLICT ("clinicId", "type", "name") DO NOTHING;
