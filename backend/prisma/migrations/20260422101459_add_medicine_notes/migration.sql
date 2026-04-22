-- AlterTable
ALTER TABLE "clinics" ADD COLUMN     "opdSeriesPrefix" TEXT;

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "dob" TIMESTAMP(3),
ADD COLUMN     "existingId" TEXT,
ADD COLUMN     "prefix" TEXT,
ALTER COLUMN "age" DROP NOT NULL;

-- AlterTable
ALTER TABLE "prescription_medicines" ALTER COLUMN "days" SET DATA TYPE TEXT,
ALTER COLUMN "qty" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "medicine_notes" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameHi" TEXT,
    "nameMr" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medicine_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_medicine_preferences" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "dosage" TEXT,
    "timing" TEXT,
    "days" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_medicine_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "medicine_notes_clinicId_nameEn_key" ON "medicine_notes"("clinicId", "nameEn");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_medicine_preferences_clinicId_doctorId_medicineId_key" ON "doctor_medicine_preferences"("clinicId", "doctorId", "medicineId");

-- AddForeignKey
ALTER TABLE "medicine_notes" ADD CONSTRAINT "medicine_notes_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
