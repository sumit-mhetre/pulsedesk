-- DropForeignKey
ALTER TABLE "medical_documents" DROP CONSTRAINT "medical_documents_doctorId_fkey";

-- AddForeignKey
ALTER TABLE "medical_documents" ADD CONSTRAINT "medical_documents_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
