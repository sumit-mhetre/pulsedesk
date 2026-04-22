-- Add note fields to DoctorMedicinePreference so notes carry over per medicine
ALTER TABLE "doctor_medicine_preferences" ADD COLUMN "notesEn" TEXT;
ALTER TABLE "doctor_medicine_preferences" ADD COLUMN "notesHi" TEXT;
ALTER TABLE "doctor_medicine_preferences" ADD COLUMN "notesMr" TEXT;

-- Index for "recently used" ordering in medicine dropdown
CREATE INDEX "doctor_medicine_preferences_clinicId_doctorId_updatedAt_idx"
  ON "doctor_medicine_preferences"("clinicId", "doctorId", "updatedAt");
