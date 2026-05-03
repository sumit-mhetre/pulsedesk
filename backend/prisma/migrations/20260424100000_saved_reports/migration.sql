-- SavedReport - custom report configs users can save + rerun
CREATE TABLE "saved_reports" (
    "id"          TEXT NOT NULL,
    "clinicId"    TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "reportType"  TEXT NOT NULL,
    "config"      JSONB NOT NULL,
    "isShared"    BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt"   TIMESTAMP(3),
    "runCount"    INTEGER NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "saved_reports_clinicId_userId_idx"     ON "saved_reports"("clinicId", "userId");
CREATE INDEX "saved_reports_clinicId_reportType_idx" ON "saved_reports"("clinicId", "reportType");
