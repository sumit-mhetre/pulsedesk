-- AlterTable
ALTER TABLE "bills" ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3);
