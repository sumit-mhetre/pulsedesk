-- Adds prescription.customData (JSON) for clinic-defined custom fields on Rx forms.
-- Nullable, no default - existing rows just have NULL.
ALTER TABLE "prescriptions" ADD COLUMN "customData" JSONB;
