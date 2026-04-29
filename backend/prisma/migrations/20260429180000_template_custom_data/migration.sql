-- Adds customData to prescription_templates so clinic-defined custom field values
-- round-trip via "Save as Template" / "Apply Template". Same JSON shape as
-- Prescription.customData: { [cfId]: string[] }. Existing templates keep NULL.

ALTER TABLE "prescription_templates" ADD COLUMN "customData" JSONB;
