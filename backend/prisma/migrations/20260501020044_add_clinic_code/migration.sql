/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `clinics` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "clinics" ADD COLUMN     "code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "clinics_code_key" ON "clinics"("code");
