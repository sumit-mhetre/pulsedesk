-- Add super admin tracking columns to AuditLog
ALTER TABLE "audit_logs"
  ADD COLUMN "actorEmail"        TEXT,
  ADD COLUMN "actorIsSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Index for efficient per-clinic + chronological queries
CREATE INDEX "audit_logs_clinicId_createdAt_idx"
  ON "audit_logs"("clinicId", "createdAt");
