-- Add frequency column to PrescriptionMedicine (default DAILY)
ALTER TABLE "prescription_medicines" ADD COLUMN "frequency" TEXT DEFAULT 'DAILY';

-- Add frequency column to DoctorMedicinePreference (carries across prescriptions)
ALTER TABLE "doctor_medicine_preferences" ADD COLUMN "frequency" TEXT;

-- Add frequency column to TemplateMedicine (remembered in templates)
ALTER TABLE "template_medicines" ADD COLUMN "frequency" TEXT;
