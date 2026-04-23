-- Add generic/composition name to Medicine master (editable by Doctor/Admin, clinic-wide)
ALTER TABLE "medicines" ADD COLUMN "genericName" TEXT;

-- Snapshot generic name at prescription-save time so edits to master don't silently rewrite old Rx
ALTER TABLE "prescription_medicines" ADD COLUMN "genericName" TEXT;
