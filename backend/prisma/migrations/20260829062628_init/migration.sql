-- CreateEnum
CREATE TYPE "AgeGroup" AS ENUM ('PEDIATRIC', 'ADULT', 'GERIATRIC');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TriageLevel" AS ENUM ('LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4', 'LEVEL_5');

-- CreateEnum
CREATE TYPE "TriageStatus" AS ENUM ('WAITING', 'IN_REVIEW', 'COMPLETED', 'REASSESSMENT');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('ESCALATE', 'DOWNGRADE', 'MODIFY_ACTIONS', 'DISMISS_ALERT');

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "mrn" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "sex" "Sex" NOT NULL,
    "ageGroup" "AgeGroup" NOT NULL,
    "medicalHistory" JSONB NOT NULL DEFAULT '[]',
    "allergies" JSONB NOT NULL DEFAULT '[]',
    "medications" JSONB NOT NULL DEFAULT '[]',
    "isFirstVisit" BOOLEAN NOT NULL DEFAULT false,
    "arrivalTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TriageEvent" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "aiSuggestedLevel" "TriageLevel" NOT NULL,
    "aiConfidenceScore" DOUBLE PRECISION NOT NULL,
    "suggestedActions" JSONB NOT NULL,
    "vitalSigns" JSONB NOT NULL,
    "symptoms" JSONB NOT NULL,
    "presentationNotes" TEXT NOT NULL,
    "uncertaintyReason" TEXT,
    "status" "TriageStatus" NOT NULL DEFAULT 'WAITING',
    "triageTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TriageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "triageEventId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "clinicianName" TEXT NOT NULL,
    "clinicianRole" TEXT NOT NULL,
    "originalAiLevel" "TriageLevel" NOT NULL,
    "overrideLevel" "TriageLevel" NOT NULL,
    "action" "AuditAction" NOT NULL,
    "overrideReason" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Patient_mrn_key" ON "Patient"("mrn");

-- CreateIndex
CREATE INDEX "Patient_ageGroup_idx" ON "Patient"("ageGroup");

-- CreateIndex
CREATE INDEX "Patient_arrivalTime_idx" ON "Patient"("arrivalTime");

-- CreateIndex
CREATE INDEX "TriageEvent_patientId_idx" ON "TriageEvent"("patientId");

-- CreateIndex
CREATE INDEX "TriageEvent_status_idx" ON "TriageEvent"("status");

-- CreateIndex
CREATE INDEX "TriageEvent_triageTime_idx" ON "TriageEvent"("triageTime");

-- CreateIndex
CREATE INDEX "AuditLog_triageEventId_idx" ON "AuditLog"("triageEventId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "TriageEvent" ADD CONSTRAINT "TriageEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_triageEventId_fkey" FOREIGN KEY ("triageEventId") REFERENCES "TriageEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
