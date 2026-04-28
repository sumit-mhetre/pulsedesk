-- Add expectedFields JSONB column to LabTest
ALTER TABLE "lab_tests" ADD COLUMN "expectedFields" JSONB;

-- LabResult: a recorded test outcome (CBC done on April 25, etc.)
CREATE TABLE "lab_results" (
  "id"             TEXT      NOT NULL,
  "clinicId"       TEXT      NOT NULL,
  "patientId"      TEXT      NOT NULL,
  "prescriptionId" TEXT,
  "labTestId"      TEXT,
  "testName"       TEXT      NOT NULL,
  "testCategory"   TEXT,
  "resultDate"     TIMESTAMP(3) NOT NULL,
  "freeTextResult" TEXT,
  "notes"          TEXT,
  "recordedById"   TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "lab_results_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lab_results_patientId_resultDate_idx"   ON "lab_results"("patientId", "resultDate");
CREATE INDEX "lab_results_clinicId_resultDate_idx"    ON "lab_results"("clinicId", "resultDate");
CREATE INDEX "lab_results_prescriptionId_idx"         ON "lab_results"("prescriptionId");

ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_prescriptionId_fkey"
  FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_labTestId_fkey"
  FOREIGN KEY ("labTestId") REFERENCES "lab_tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- LabResultValue: individual values within a lab result (Hb=12.5, WBC=7800, etc.)
CREATE TABLE "lab_result_values" (
  "id"          TEXT NOT NULL,
  "labResultId" TEXT NOT NULL,
  "fieldKey"    TEXT NOT NULL,
  "fieldLabel"  TEXT NOT NULL,
  "fieldUnit"   TEXT,
  "value"       TEXT NOT NULL,
  "normalLow"   DOUBLE PRECISION,
  "normalHigh"  DOUBLE PRECISION,
  CONSTRAINT "lab_result_values_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lab_result_values_labResultId_idx" ON "lab_result_values"("labResultId");
CREATE INDEX "lab_result_values_fieldKey_idx"    ON "lab_result_values"("fieldKey");

ALTER TABLE "lab_result_values" ADD CONSTRAINT "lab_result_values_labResultId_fkey"
  FOREIGN KEY ("labResultId") REFERENCES "lab_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;
