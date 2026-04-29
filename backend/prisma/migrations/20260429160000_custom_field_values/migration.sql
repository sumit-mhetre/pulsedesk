-- Adds the custom_field_values master table for clinic-defined Rx custom fields.
-- One row per (clinic, fieldId, value) triple. Acts as the autocomplete suggestion
-- list per custom field. New values are upserted on Rx save.
-- The unique constraint ensures we never store the same suggestion twice for a field.

CREATE TABLE "custom_field_values" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_field_values_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "custom_field_values_clinicId_fieldId_value_key" ON "custom_field_values"("clinicId", "fieldId", "value");
CREATE INDEX "custom_field_values_clinicId_fieldId_idx" ON "custom_field_values"("clinicId", "fieldId");

ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
