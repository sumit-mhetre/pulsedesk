-- ═══════════════════════════════════════════════════════════════════════
-- IPD Module — Database migration
-- ═══════════════════════════════════════════════════════════════════════
-- Adds 9 new enums, 15 new tables, and small additions to 6 existing tables.
-- All operations are idempotent (IF NOT EXISTS / DO blocks) so reruns are safe.
-- All new columns on existing tables are nullable / default-valued — zero
-- breakage to existing OPD code.
-- ═══════════════════════════════════════════════════════════════════════


-- ─── PART 1: NEW ENUMS ────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "FacilityType" AS ENUM ('CLINIC_ONLY', 'NURSING_HOME', 'HOSPITAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "BedType" AS ENUM ('GENERAL', 'SEMI_PRIVATE', 'PRIVATE', 'ICU', 'HDU', 'LABOUR', 'DAY_CARE', 'ISOLATION', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "BedStatus" AS ENUM ('VACANT', 'OCCUPIED', 'CLEANING', 'BLOCKED', 'RESERVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "AdmissionStatus" AS ENUM ('ADMITTED', 'DISCHARGED', 'DAMA', 'DEATH', 'TRANSFERRED_OUT', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "IPDChargeType" AS ENUM ('BED_RENT', 'DOCTOR_VISIT', 'CONSULTATION', 'NURSING_CARE', 'MEDICINE', 'CONSUMABLE', 'LAB_TEST', 'IMAGING', 'PROCEDURE', 'OT_CHARGE', 'PACKAGE', 'PACKAGE_EXTRA', 'DEPOSIT_REFUND', 'ADJUSTMENT', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "IPDOrderType" AS ENUM ('LAB_TEST', 'IMAGING', 'DIET', 'NURSING_INSTRUCTION', 'PHYSIOTHERAPY', 'CONSULTATION_REFERRAL', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "IPDOrderStatus" AS ENUM ('ORDERED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'HELD');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "NursingShift" AS ENUM ('MORNING', 'AFTERNOON', 'NIGHT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ConsentType" AS ENUM ('ADMISSION', 'SURGERY', 'ANESTHESIA', 'BLOOD_TRANSFUSION', 'HIGH_RISK', 'HIV_TEST', 'PHOTOGRAPHY', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "MARStatus" AS ENUM ('PENDING', 'GIVEN', 'REFUSED', 'HELD', 'MISSED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "MedicationOrderStatus" AS ENUM ('ACTIVE', 'STOPPED', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- ─── PART 2: ADD NURSE TO EXISTING Role ENUM ──────────────────────────
-- ALTER TYPE ... ADD VALUE IF NOT EXISTS works on Postgres 9.6+ (we're on 16+).

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'NURSE';


-- ─── PART 3: ADD COLUMNS TO EXISTING TABLES ───────────────────────────

-- Clinic — IPD config fields
ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "facilityType" "FacilityType" NOT NULL DEFAULT 'CLINIC_ONLY';
ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "ipdEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "ipdNumberCounters" JSONB;
ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "ipdSettings" JSONB;

-- Bill — link to admission + bill type
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "admissionId" TEXT;
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "billType" TEXT;

-- Prescription — link to admission + prescription type
ALTER TABLE "prescriptions" ADD COLUMN IF NOT EXISTS "admissionId" TEXT;
ALTER TABLE "prescriptions" ADD COLUMN IF NOT EXISTS "prescriptionType" TEXT NOT NULL DEFAULT 'OPD';


-- ─── PART 4: NEW TABLES ───────────────────────────────────────────────

-- Beds
CREATE TABLE IF NOT EXISTS "beds" (
  "id"                  TEXT NOT NULL,
  "clinicId"            TEXT NOT NULL,
  "bedNumber"           TEXT NOT NULL,
  "bedType"             "BedType" NOT NULL,
  "ward"                TEXT,
  "floor"               TEXT,
  "status"              "BedStatus" NOT NULL DEFAULT 'VACANT',
  "isActive"            BOOLEAN NOT NULL DEFAULT true,
  "dailyRate"           DOUBLE PRECISION NOT NULL,
  "currentAdmissionId"  TEXT,
  "notes"               TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "beds_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "beds_currentAdmissionId_key"   ON "beds"("currentAdmissionId");
CREATE UNIQUE INDEX IF NOT EXISTS "beds_clinicId_bedNumber_key"   ON "beds"("clinicId", "bedNumber");
CREATE INDEX        IF NOT EXISTS "beds_clinicId_status_idx"      ON "beds"("clinicId", "status");
CREATE INDEX        IF NOT EXISTS "beds_clinicId_isActive_idx"    ON "beds"("clinicId", "isActive");

-- Admissions
CREATE TABLE IF NOT EXISTS "admissions" (
  "id"                    TEXT NOT NULL,
  "clinicId"              TEXT NOT NULL,
  "admissionNumber"       TEXT NOT NULL,
  "patientId"             TEXT NOT NULL,
  "primaryDoctorId"       TEXT NOT NULL,
  "bedId"                 TEXT,
  "status"                "AdmissionStatus" NOT NULL DEFAULT 'ADMITTED',
  "admittedAt"            TIMESTAMP(3) NOT NULL,
  "dischargedAt"          TIMESTAMP(3),
  "provisionalDiagnosis"  TEXT,
  "finalDiagnosis"        TEXT,
  "admissionNotes"        TEXT,
  "reasonForAdmission"    TEXT,
  "isMLC"                 BOOLEAN NOT NULL DEFAULT false,
  "mlcNumber"             TEXT,
  "admissionSource"       TEXT,
  "referredFrom"          TEXT,
  "attendantName"         TEXT,
  "attendantRelation"     TEXT,
  "attendantPhone"        TEXT,
  "attendantAddress"      TEXT,
  "attendantIdProof"      TEXT,
  "paymentMode"           TEXT,
  "insuranceProvider"     TEXT,
  "insurancePolicy"       TEXT,
  "initialDeposit"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "dischargeNotes"        TEXT,
  "dischargeAdvice"       TEXT,
  "causeOfDeath"          TEXT,
  "damaReason"            TEXT,
  "totalCharges"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalPaid"             DOUBLE PRECISION NOT NULL DEFAULT 0,
  "metadata"              JSONB,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,
  CONSTRAINT "admissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "admissions_clinicId_admissionNumber_key" ON "admissions"("clinicId", "admissionNumber");
CREATE INDEX        IF NOT EXISTS "admissions_clinicId_status_idx"          ON "admissions"("clinicId", "status");
CREATE INDEX        IF NOT EXISTS "admissions_clinicId_admittedAt_idx"      ON "admissions"("clinicId", "admittedAt");
CREATE INDEX        IF NOT EXISTS "admissions_patientId_idx"                ON "admissions"("patientId");
CREATE INDEX        IF NOT EXISTS "admissions_primaryDoctorId_idx"          ON "admissions"("primaryDoctorId");

-- Bed transfers
CREATE TABLE IF NOT EXISTS "bed_transfers" (
  "id"              TEXT NOT NULL,
  "admissionId"     TEXT NOT NULL,
  "fromBedId"       TEXT,
  "toBedId"         TEXT NOT NULL,
  "transferredAt"   TIMESTAMP(3) NOT NULL,
  "reason"          TEXT,
  "transferredById" TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bed_transfers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "bed_transfers_admissionId_idx"    ON "bed_transfers"("admissionId");
CREATE INDEX IF NOT EXISTS "bed_transfers_transferredAt_idx"  ON "bed_transfers"("transferredAt");

-- IPD charges
CREATE TABLE IF NOT EXISTS "ipd_charges" (
  "id"              TEXT NOT NULL,
  "admissionId"     TEXT NOT NULL,
  "chargedAt"       TIMESTAMP(3) NOT NULL,
  "chargeType"      "IPDChargeType" NOT NULL,
  "description"     TEXT NOT NULL,
  "quantity"        INTEGER NOT NULL DEFAULT 1,
  "unitPrice"       DOUBLE PRECISION NOT NULL,
  "amount"          DOUBLE PRECISION NOT NULL,
  "medicineId"      TEXT,
  "labTestId"       TEXT,
  "packageId"       TEXT,
  "bedTransferId"   TEXT,
  "isAutoGenerated" BOOLEAN NOT NULL DEFAULT false,
  "voidedAt"        TIMESTAMP(3),
  "voidReason"      TEXT,
  "addedById"       TEXT NOT NULL,
  "notes"           TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ipd_charges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ipd_charges_admissionId_chargedAt_idx"  ON "ipd_charges"("admissionId", "chargedAt");
CREATE INDEX IF NOT EXISTS "ipd_charges_admissionId_chargeType_idx" ON "ipd_charges"("admissionId", "chargeType");
CREATE INDEX IF NOT EXISTS "ipd_charges_admissionId_voidedAt_idx"   ON "ipd_charges"("admissionId", "voidedAt");

-- Billing packages
CREATE TABLE IF NOT EXISTS "billing_packages" (
  "id"            TEXT NOT NULL,
  "clinicId"      TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "code"          TEXT,
  "category"      TEXT,
  "description"   TEXT,
  "inclusions"    TEXT,
  "exclusions"    TEXT,
  "basePrice"     DOUBLE PRECISION NOT NULL,
  "durationDays"  INTEGER NOT NULL DEFAULT 2,
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billing_packages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "billing_packages_clinicId_name_key"     ON "billing_packages"("clinicId", "name");
CREATE INDEX        IF NOT EXISTS "billing_packages_clinicId_isActive_idx" ON "billing_packages"("clinicId", "isActive");

-- Admission packages
CREATE TABLE IF NOT EXISTS "admission_packages" (
  "id"            TEXT NOT NULL,
  "admissionId"   TEXT NOT NULL,
  "packageId"     TEXT NOT NULL,
  "agreedPrice"   DOUBLE PRECISION NOT NULL,
  "notes"         TEXT,
  "appliedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "appliedById"   TEXT NOT NULL,
  CONSTRAINT "admission_packages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "admission_packages_admissionId_idx" ON "admission_packages"("admissionId");

-- Round notes (doctor SOAP)
CREATE TABLE IF NOT EXISTS "round_notes" (
  "id"            TEXT NOT NULL,
  "admissionId"   TEXT NOT NULL,
  "recordedAt"    TIMESTAMP(3) NOT NULL,
  "doctorId"      TEXT NOT NULL,
  "subjective"    TEXT,
  "objective"     TEXT,
  "assessment"    TEXT,
  "plan"          TEXT,
  "freeText"      TEXT,
  "isCritical"    BOOLEAN NOT NULL DEFAULT false,
  "needsFollowUp" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "round_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "round_notes_admissionId_recordedAt_idx" ON "round_notes"("admissionId", "recordedAt");

-- IPD vitals
CREATE TABLE IF NOT EXISTS "ipd_vital_records" (
  "id"            TEXT NOT NULL,
  "admissionId"   TEXT NOT NULL,
  "recordedAt"    TIMESTAMP(3) NOT NULL,
  "recordedById"  TEXT NOT NULL,
  "bp"            TEXT,
  "pulse"         INTEGER,
  "temperature"   DOUBLE PRECISION,
  "spo2"          INTEGER,
  "respRate"      INTEGER,
  "bloodSugar"    INTEGER,
  "painScore"     INTEGER,
  "notes"         TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ipd_vital_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ipd_vital_records_admissionId_recordedAt_idx" ON "ipd_vital_records"("admissionId", "recordedAt");

-- Nursing notes
CREATE TABLE IF NOT EXISTS "nursing_notes" (
  "id"            TEXT NOT NULL,
  "admissionId"   TEXT NOT NULL,
  "recordedAt"    TIMESTAMP(3) NOT NULL,
  "shift"         "NursingShift" NOT NULL,
  "nurseId"       TEXT NOT NULL,
  "observations"  TEXT,
  "careActions"   TEXT,
  "handoverNotes" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "nursing_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "nursing_notes_admissionId_recordedAt_idx" ON "nursing_notes"("admissionId", "recordedAt");

-- Medication orders
CREATE TABLE IF NOT EXISTS "medication_orders" (
  "id"              TEXT NOT NULL,
  "admissionId"     TEXT NOT NULL,
  "medicineId"      TEXT,
  "medicineName"    TEXT NOT NULL,
  "dose"            TEXT NOT NULL,
  "route"           TEXT NOT NULL,
  "frequency"       TEXT NOT NULL,
  "customSchedule"  JSONB,
  "startDate"       TIMESTAMP(3) NOT NULL,
  "stopDate"        TIMESTAMP(3),
  "duration"        TEXT,
  "notes"           TEXT,
  "prescribedById"  TEXT NOT NULL,
  "status"          "MedicationOrderStatus" NOT NULL DEFAULT 'ACTIVE',
  "stoppedAt"       TIMESTAMP(3),
  "stopReason"      TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "medication_orders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "medication_orders_admissionId_status_idx" ON "medication_orders"("admissionId", "status");

-- Medication administrations (MAR)
CREATE TABLE IF NOT EXISTS "medication_administrations" (
  "id"            TEXT NOT NULL,
  "orderId"       TEXT NOT NULL,
  "scheduledTime" TIMESTAMP(3) NOT NULL,
  "status"        "MARStatus" NOT NULL DEFAULT 'PENDING',
  "actualTime"    TIMESTAMP(3),
  "givenById"     TEXT,
  "notes"         TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "medication_administrations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "medication_administrations_orderId_scheduledTime_idx"     ON "medication_administrations"("orderId", "scheduledTime");
CREATE INDEX IF NOT EXISTS "medication_administrations_scheduledTime_status_idx"      ON "medication_administrations"("scheduledTime", "status");

-- IPD orders (lab/imaging/diet/etc.)
CREATE TABLE IF NOT EXISTS "ipd_orders" (
  "id"                TEXT NOT NULL,
  "admissionId"       TEXT NOT NULL,
  "orderType"         "IPDOrderType" NOT NULL,
  "description"       TEXT NOT NULL,
  "details"           JSONB,
  "status"            "IPDOrderStatus" NOT NULL DEFAULT 'ORDERED',
  "orderedAt"         TIMESTAMP(3) NOT NULL,
  "orderedById"       TEXT NOT NULL,
  "acknowledgedAt"    TIMESTAMP(3),
  "acknowledgedById"  TEXT,
  "completedAt"       TIMESTAMP(3),
  "completedById"     TEXT,
  "cancelledAt"       TIMESTAMP(3),
  "cancelledReason"   TEXT,
  "notes"             TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ipd_orders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ipd_orders_admissionId_status_idx"    ON "ipd_orders"("admissionId", "status");
CREATE INDEX IF NOT EXISTS "ipd_orders_admissionId_orderedAt_idx" ON "ipd_orders"("admissionId", "orderedAt");

-- Intake/output records
CREATE TABLE IF NOT EXISTS "intake_output_records" (
  "id"            TEXT NOT NULL,
  "admissionId"   TEXT NOT NULL,
  "recordedAt"    TIMESTAMP(3) NOT NULL,
  "shift"         "NursingShift",
  "recordedById"  TEXT NOT NULL,
  "oralIntake"    INTEGER,
  "ivFluids"      INTEGER,
  "rylesTubeFeed" INTEGER,
  "urineOutput"   INTEGER,
  "drainOutput"   INTEGER,
  "vomit"         INTEGER,
  "stoolCount"    INTEGER,
  "notes"         TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "intake_output_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "intake_output_records_admissionId_recordedAt_idx" ON "intake_output_records"("admissionId", "recordedAt");

-- Consents
CREATE TABLE IF NOT EXISTS "consents" (
  "id"              TEXT NOT NULL,
  "admissionId"     TEXT NOT NULL,
  "consentType"     "ConsentType" NOT NULL,
  "signedByPatient" BOOLEAN NOT NULL DEFAULT false,
  "patientSignDate" TIMESTAMP(3),
  "signedByWitness" BOOLEAN NOT NULL DEFAULT false,
  "witnessName"     TEXT,
  "witnessSignDate" TIMESTAMP(3),
  "documentUrl"     TEXT,
  "consentText"     TEXT,
  "notes"           TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "consents_admissionId_consentType_idx" ON "consents"("admissionId", "consentType");

-- Consultations (cross-specialty)
CREATE TABLE IF NOT EXISTS "consultations" (
  "id"                  TEXT NOT NULL,
  "admissionId"         TEXT NOT NULL,
  "consultantDoctorId"  TEXT,
  "consultantName"      TEXT NOT NULL,
  "consultantSpecialty" TEXT,
  "requestedAt"         TIMESTAMP(3) NOT NULL,
  "consultedAt"         TIMESTAMP(3),
  "reason"              TEXT NOT NULL,
  "notes"               TEXT,
  "recommendations"     TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "consultations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "consultations_admissionId_idx" ON "consultations"("admissionId");


-- ─── PART 5: FOREIGN KEY CONSTRAINTS ──────────────────────────────────
-- Wrapped in DO blocks to skip if already added (re-run safety).

-- Bills → Admission
DO $$ BEGIN
  ALTER TABLE "bills" ADD CONSTRAINT "bills_admissionId_fkey"
    FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Prescriptions → Admission
DO $$ BEGIN
  ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_admissionId_fkey"
    FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Beds → Clinic
DO $$ BEGIN
  ALTER TABLE "beds" ADD CONSTRAINT "beds_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Admissions → Clinic, Patient, User (primaryDoctor), Bed
DO $$ BEGIN
  ALTER TABLE "admissions" ADD CONSTRAINT "admissions_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "admissions" ADD CONSTRAINT "admissions_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "admissions" ADD CONSTRAINT "admissions_primaryDoctorId_fkey"
    FOREIGN KEY ("primaryDoctorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "admissions" ADD CONSTRAINT "admissions_bedId_fkey"
    FOREIGN KEY ("bedId") REFERENCES "beds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Bed transfers
DO $$ BEGIN
  ALTER TABLE "bed_transfers" ADD CONSTRAINT "bed_transfers_admissionId_fkey"
    FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "bed_transfers" ADD CONSTRAINT "bed_transfers_fromBedId_fkey"
    FOREIGN KEY ("fromBedId") REFERENCES "beds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "bed_transfers" ADD CONSTRAINT "bed_transfers_toBedId_fkey"
    FOREIGN KEY ("toBedId") REFERENCES "beds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "bed_transfers" ADD CONSTRAINT "bed_transfers_transferredById_fkey"
    FOREIGN KEY ("transferredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- IPD charges
DO $$ BEGIN
  ALTER TABLE "ipd_charges" ADD CONSTRAINT "ipd_charges_admissionId_fkey"
    FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ipd_charges" ADD CONSTRAINT "ipd_charges_addedById_fkey"
    FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Billing packages
DO $$ BEGIN
  ALTER TABLE "billing_packages" ADD CONSTRAINT "billing_packages_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Admission packages
DO $$ BEGIN
  ALTER TABLE "admission_packages" ADD CONSTRAINT "admission_packages_admissionId_fkey"
    FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "admission_packages" ADD CONSTRAINT "admission_packages_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "billing_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "admission_packages" ADD CONSTRAINT "admission_packages_appliedById_fkey"
    FOREIGN KEY ("appliedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Round notes
DO $$ BEGIN
  ALTER TABLE "round_notes" ADD CONSTRAINT "round_notes_admissionId_fkey"
    FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "round_notes" ADD CONSTRAINT "round_notes_doctorId_fkey"
    FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- IPD vital records
DO $$ BEGIN
  ALTER TABLE "ipd_vital_records" ADD CONSTRAINT "ipd_vital_records_admissionId_fkey"
    FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ipd_vital_records" ADD CONSTRAINT "ipd_vital_records_recordedById_fkey"
    FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Nursing notes
DO $$ BEGIN
  ALTER TABLE "nursing_notes" ADD CONSTRAINT "nursing_notes_admissionId_fkey"
    FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "nursing_notes" ADD CONSTRAINT "nursing_notes_nurseId_fkey"
    FOREIGN KEY ("nurseId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Medication orders
DO $$ BEGIN
  ALTER TABLE "medication_orders" ADD CONSTRAINT "medication_orders_admissionId_fkey"
    FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "medication_orders" ADD CONSTRAINT "medication_orders_medicineId_fkey"
    FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "medication_orders" ADD CONSTRAINT "medication_orders_prescribedById_fkey"
    FOREIGN KEY ("prescribedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Medication administrations
DO $$ BEGIN
  ALTER TABLE "medication_administrations" ADD CONSTRAINT "medication_administrations_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "medication_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "medication_administrations" ADD CONSTRAINT "medication_administrations_givenById_fkey"
    FOREIGN KEY ("givenById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- IPD orders
DO $$ BEGIN
  ALTER TABLE "ipd_orders" ADD CONSTRAINT "ipd_orders_admissionId_fkey"
    FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ipd_orders" ADD CONSTRAINT "ipd_orders_orderedById_fkey"
    FOREIGN KEY ("orderedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Intake/output
DO $$ BEGIN
  ALTER TABLE "intake_output_records" ADD CONSTRAINT "intake_output_records_admissionId_fkey"
    FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "intake_output_records" ADD CONSTRAINT "intake_output_records_recordedById_fkey"
    FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Consents
DO $$ BEGIN
  ALTER TABLE "consents" ADD CONSTRAINT "consents_admissionId_fkey"
    FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Consultations
DO $$ BEGIN
  ALTER TABLE "consultations" ADD CONSTRAINT "consultations_admissionId_fkey"
    FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "consultations" ADD CONSTRAINT "consultations_consultantDoctorId_fkey"
    FOREIGN KEY ("consultantDoctorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Done.
