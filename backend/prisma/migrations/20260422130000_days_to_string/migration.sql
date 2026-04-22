-- Convert days column from INT to TEXT on template_medicines
-- Preserves existing values: 5 (Int) -> "5 days" (String)
ALTER TABLE "template_medicines" 
  ALTER COLUMN "days" TYPE TEXT USING (
    CASE 
      WHEN "days" IS NULL THEN NULL 
      ELSE "days"::text || ' days' 
    END
  );

-- Convert days column from INT to TEXT on doctor_medicine_preferences
-- Preserves existing values: 5 (Int) -> "5 days" (String)
ALTER TABLE "doctor_medicine_preferences" 
  ALTER COLUMN "days" TYPE TEXT USING (
    CASE 
      WHEN "days" IS NULL THEN NULL 
      ELSE "days"::text || ' days' 
    END
  );
