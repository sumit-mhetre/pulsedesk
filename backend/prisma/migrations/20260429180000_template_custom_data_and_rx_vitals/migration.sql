-- Adds customData to prescription_templates so clinic-defined custom field values
-- round-trip via "Save as Template" / "Apply Template". Same JSON shape as
-- Prescription.customData: { [cfId]: string[] }. Existing templates keep NULL.
ALTER TABLE "prescription_templates" ADD COLUMN IF NOT EXISTS "customData" JSONB;

-- Adds vitals snapshot to prescriptions. Stores the BP/sugar/weight/temp/spo2/pulse
-- values the doctor recorded at the moment of writing this Rx. Independent of the
-- patient's VitalRecord timeline so historical Rxs always print the values that
-- existed at write-time, not whatever the latest vitals are. Existing rows keep NULL.
ALTER TABLE "prescriptions" ADD COLUMN "vitals" JSONB;
