-- Add settings JSONB column to Clinic for misc per-clinic config flags.
-- Examples of keys that can live here: flagOutOfRangeLabValues (bool), other future toggles.
ALTER TABLE "clinics" ADD COLUMN "settings" JSONB;
