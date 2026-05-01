/*
  Warnings:

  - Made the column `dailyRate` on table `beds` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "bed_transfers" ADD COLUMN     "nurseHandoverNote" TEXT;

-- AlterTable
ALTER TABLE "beds" ALTER COLUMN "dailyRate" SET NOT NULL,
ALTER COLUMN "dailyRate" DROP DEFAULT;

-- AlterTable
ALTER TABLE "lab_results" ADD COLUMN     "admissionId" TEXT;

-- AlterTable
ALTER TABLE "medication_orders" ADD COLUMN     "expectedQty" TEXT,
ADD COLUMN     "procurementMode" TEXT NOT NULL DEFAULT 'PROCURE';

-- CreateIndex
CREATE INDEX "lab_results_admissionId_idx" ON "lab_results"("admissionId");

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
