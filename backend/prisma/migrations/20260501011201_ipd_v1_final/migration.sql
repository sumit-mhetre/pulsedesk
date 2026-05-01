/*
  Warnings:

  - Made the column `dailyRate` on table `beds` required. This step will fail if there are existing NULL values in that column.

  Note: 3 statements were applied manually in production
  (ALTER lab_results ADD COLUMN admissionId, CREATE INDEX, ADD CONSTRAINT
  fkey). Those have been removed from this migration to prevent re-apply
  conflicts. Local databases that already ran the original migration are
  unaffected -- the column/index/FK already exist there too.
*/

-- AlterTable
ALTER TABLE "bed_transfers" ADD COLUMN     "nurseHandoverNote" TEXT;

-- AlterTable
ALTER TABLE "beds" ALTER COLUMN "dailyRate" SET NOT NULL,
ALTER COLUMN "dailyRate" DROP DEFAULT;

-- AlterTable
ALTER TABLE "medication_orders" ADD COLUMN     "expectedQty" TEXT,
ADD COLUMN     "procurementMode" TEXT NOT NULL DEFAULT 'PROCURE';