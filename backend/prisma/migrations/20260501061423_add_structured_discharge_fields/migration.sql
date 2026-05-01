-- CreateEnum
CREATE TYPE "ConditionAtDischarge" AS ENUM ('STABLE', 'IMPROVED', 'STATUS_QUO', 'REFERRED', 'DAMA', 'DECEASED');

-- AlterTable
ALTER TABLE "admissions" ADD COLUMN     "activityAdvice" TEXT,
ADD COLUMN     "admissionVitals" JSONB,
ADD COLUMN     "chiefComplaints" TEXT,
ADD COLUMN     "conditionAtDischarge" "ConditionAtDischarge",
ADD COLUMN     "dietAdvice" TEXT,
ADD COLUMN     "dischargeVitals" JSONB,
ADD COLUMN     "followUpDate" TIMESTAMP(3),
ADD COLUMN     "followUpInstructions" TEXT,
ADD COLUMN     "generalExam" TEXT,
ADD COLUMN     "historyOfIllness" TEXT,
ADD COLUMN     "keyInvestigations" TEXT,
ADD COLUMN     "pastAsthma" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pastDM" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pastHTN" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pastIHD" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pastOther" TEXT,
ADD COLUMN     "pastSurgical" TEXT,
ADD COLUMN     "pastTB" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "specialInstructions" TEXT,
ADD COLUMN     "systemicExamCNS" TEXT,
ADD COLUMN     "systemicExamCVS" TEXT,
ADD COLUMN     "systemicExamPA" TEXT,
ADD COLUMN     "systemicExamRS" TEXT,
ADD COLUMN     "treatmentSummary" TEXT,
ADD COLUMN     "warningSigns" TEXT;

-- CreateTable
CREATE TABLE "discharge_medications" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "medicineId" TEXT,
    "brandName" TEXT NOT NULL,
    "genericName" TEXT,
    "dose" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "instructions" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discharge_medications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discharge_medications_admissionId_idx" ON "discharge_medications"("admissionId");

-- AddForeignKey
ALTER TABLE "discharge_medications" ADD CONSTRAINT "discharge_medications_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discharge_medications" ADD CONSTRAINT "discharge_medications_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
