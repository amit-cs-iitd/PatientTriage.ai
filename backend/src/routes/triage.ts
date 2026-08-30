import { Router, Request, Response } from "express";
import { AgeGroup, AuditAction, Sex, TriageLevel, TriageStatus } from "@prisma/client";
import prisma from "../lib/prisma";
import {
  runTriageAssessment,
  toPrismaTriageLevel,
} from "../services/triageAgent";
import type {
  AllergyItem,
  MedicalHistoryItem,
  MedicationItem,
  VitalSigns,
} from "../types";
import { parseMedicalHistory, toJsonValue } from "../types";
import { normalizeSymptoms } from "../services/nlpParser";

const router = Router();

interface TriageAssessBody {
  patientId?: string;
  mrn?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  sex?: Sex;
  ageGroup?: AgeGroup;
  medicalHistory?: MedicalHistoryItem[];
  allergies?: AllergyItem[];
  medications?: MedicationItem[];
  isFirstVisit?: boolean;
  arrivalTime?: string;
  vitalSigns: VitalSigns;
  symptoms: string[];
  presentationNotes?: string;
  status?: TriageStatus;
}

interface OverrideBody {
  triageEventId: string;
  overrideLevel: number;
  overrideReason: string;
}

function isValidAgeGroup(value: string): value is AgeGroup {
  return Object.values(AgeGroup).includes(value as AgeGroup);
}

function isValidSex(value: string): value is Sex {
  return Object.values(Sex).includes(value as Sex);
}

function validateVitalSigns(vitals: VitalSigns): string | null {
  const required: (keyof VitalSigns)[] = [
    "heartRateBpm",
    "bloodPressure",
    "temperatureCelsius",
    "respiratoryRate",
    "oxygenSaturationPct",
    "painScore",
  ];
  for (const key of required) {
    if (vitals[key] === undefined || vitals[key] === null) {
      return `Missing required vital sign: ${key}`;
    }
  }
  if (vitals.painScore < 0 || vitals.painScore > 10) {
    return "painScore must be between 0 and 10";
  }
  return null;
}

const LEVEL_MAP: Record<number, TriageLevel> = {
  1: TriageLevel.LEVEL_1,
  2: TriageLevel.LEVEL_2,
  3: TriageLevel.LEVEL_3,
  4: TriageLevel.LEVEL_4,
  5: TriageLevel.LEVEL_5,
};

const LEVEL_NUM: Record<string, number> = {
  LEVEL_1: 1,
  LEVEL_2: 2,
  LEVEL_3: 3,
  LEVEL_4: 4,
  LEVEL_5: 5,
};

router.get("/queue", async (_req: Request, res: Response) => {
  try {
    const activeStatuses = [
      TriageStatus.WAITING,
      TriageStatus.IN_REVIEW,
      TriageStatus.REASSESSMENT,
    ];

    const events = await prisma.triageEvent.findMany({
      where: { status: { in: activeStatuses } },
      include: {
        patient: true,
        auditLogs: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: [{ triageTime: "desc" }],
    });

    const latestByPatient = new Map<string, (typeof events)[number]>();
    for (const event of events) {
      if (!latestByPatient.has(event.patientId)) {
        latestByPatient.set(event.patientId, event);
      }
    }

    const levelPriority: Record<string, number> = {
      LEVEL_1: 1,
      LEVEL_2: 2,
      LEVEL_3: 3,
      LEVEL_4: 4,
      LEVEL_5: 5,
    };

    const queue = [...latestByPatient.values()].sort((a, b) => {
      const levelDiff =
        levelPriority[a.aiSuggestedLevel] - levelPriority[b.aiSuggestedLevel];
      if (levelDiff !== 0) return levelDiff;
      return a.triageTime.getTime() - b.triageTime.getTime();
    });

    res.json({
      queue: queue.map(({ patient, auditLogs, ...triageEvent }) => ({
        patient,
        triageEvent,
        latestAuditLog: auditLogs.length > 0 ? auditLogs[0] : null,
      })),
    });
  } catch (error) {
    console.error("Queue fetch failed:", error);
    res.status(500).json({ error: "Internal server error fetching triage queue" });
  }
});

router.get("/patient/:mrn", async (req: Request, res: Response) => {
  try {
    const mrn = req.params.mrn as string;
    const patient = await prisma.patient.findUnique({
      where: { mrn },
    });
    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }
    res.json({ patient });
  } catch (error) {
    console.error("Patient lookup failed:", error);
    res.status(500).json({ error: "Internal server error looking up patient" });
  }
});

router.post("/assess", async (req: Request, res: Response) => {
  try {
    const body = req.body as TriageAssessBody;

    if (!body.vitalSigns) {
      res.status(400).json({ error: "vitalSigns is required" });
      return;
    }
    if (!Array.isArray(body.symptoms) || body.symptoms.length === 0) {
      res.status(400).json({ error: "symptoms must be a non-empty array" });
      return;
    }

    const vitalError = validateVitalSigns(body.vitalSigns);
    if (vitalError) {
      res.status(400).json({ error: vitalError });
      return;
    }

    let patient;

    if (body.patientId) {
      patient = await prisma.patient.findUnique({
        where: { id: body.patientId },
      });
      if (!patient) {
        res.status(404).json({ error: `Patient not found: ${body.patientId}` });
        return;
      }
    } else {
      if (
        !body.mrn ||
        !body.firstName ||
        !body.lastName ||
        !body.dateOfBirth ||
        !body.sex ||
        !body.ageGroup
      ) {
        res.status(400).json({
          error:
            "New patient intake requires mrn, firstName, lastName, dateOfBirth, sex, and ageGroup (or provide patientId)",
        });
        return;
      }
      if (!isValidSex(body.sex)) {
        res.status(400).json({ error: `Invalid sex: ${body.sex}` });
        return;
      }
      if (!isValidAgeGroup(body.ageGroup)) {
        res.status(400).json({ error: `Invalid ageGroup: ${body.ageGroup}` });
        return;
      }

      try {
        patient = await prisma.patient.create({
          data: {
            mrn: body.mrn,
            firstName: body.firstName,
            lastName: body.lastName,
            dateOfBirth: new Date(body.dateOfBirth),
            sex: body.sex,
            ageGroup: body.ageGroup,
            medicalHistory: toJsonValue(body.medicalHistory ?? []),
            allergies: toJsonValue(body.allergies ?? []),
            medications: toJsonValue(body.medications ?? []),
            isFirstVisit: body.isFirstVisit ?? true,
            arrivalTime: body.arrivalTime ? new Date(body.arrivalTime) : new Date(),
          },
        });
      } catch (error: any) {
        if (error.code === "P2002") {
          res.status(409).json({ error: "MRN already exists. Please use the MRN Lookup tool for returning patients." });
          return;
        }
        throw error;
      }
    }

    const medicalHistory =
      body.medicalHistory ?? parseMedicalHistory(patient.medicalHistory);
    const isFirstVisit = body.isFirstVisit ?? patient.isFirstVisit;
    const ageGroup = body.ageGroup ?? patient.ageGroup;

    // --- LLM Normalisation Step ---
    const normalizedSymptoms = await normalizeSymptoms(
      body.symptoms,
      body.presentationNotes,
    );

    const assessment = runTriageAssessment({
      vitalSigns: body.vitalSigns,
      ageGroup,
      medicalHistory,
      symptoms: normalizedSymptoms,
      isFirstVisit,
      presentationNotes: body.presentationNotes,
    });

    const triageEvent = await prisma.triageEvent.create({
      data: {
        patientId: patient.id,
        aiSuggestedLevel: toPrismaTriageLevel(assessment.safety.triageLevel),
        aiConfidenceScore: assessment.safety.aiConfidenceScore,
        suggestedActions: toJsonValue(assessment.flow.suggestedActions),
        vitalSigns: toJsonValue(body.vitalSigns),
        symptoms: toJsonValue(normalizedSymptoms),
        presentationNotes: body.presentationNotes ?? "",
        uncertaintyReason: assessment.safety.uncertaintyReason,
        status: body.status ?? TriageStatus.WAITING,
        triageTime: new Date(),
      },
      include: { patient: true },
    });

    res.status(201).json({
      patient: triageEvent.patient,
      triageEvent: {
        id: triageEvent.id,
        patientId: triageEvent.patientId,
        aiSuggestedLevel: triageEvent.aiSuggestedLevel,
        aiConfidenceScore: triageEvent.aiConfidenceScore,
        suggestedActions: triageEvent.suggestedActions,
        vitalSigns: triageEvent.vitalSigns,
        symptoms: triageEvent.symptoms,
        presentationNotes: triageEvent.presentationNotes,
        uncertaintyReason: triageEvent.uncertaintyReason,
        status: triageEvent.status,
        triageTime: triageEvent.triageTime,
        createdAt: triageEvent.createdAt,
      },
      assessment: {
        triageLevel: assessment.safety.triageLevel,
        aiConfidenceScore: assessment.safety.aiConfidenceScore,
        uncertaintyReason: assessment.safety.uncertaintyReason,
        suggestedActions: assessment.flow.suggestedActions,
      },
    });
  } catch (error) {
    console.error("Triage assessment failed:", error);
    res.status(500).json({ error: "Internal server error during triage assessment" });
  }
});

// ---------------------------------------------------------------------------
// Clinician Override — HIPAA-compliant audit trail
// ---------------------------------------------------------------------------

router.post("/override", async (req: Request, res: Response) => {
  try {
    const body = req.body as OverrideBody;

    // --- Validation ---
    if (!body.triageEventId) {
      res.status(400).json({ error: "triageEventId is required" });
      return;
    }
    if (
      typeof body.overrideLevel !== "number" ||
      body.overrideLevel < 1 ||
      body.overrideLevel > 5
    ) {
      res.status(400).json({ error: "overrideLevel must be an integer between 1 and 5" });
      return;
    }
    if (
      !body.overrideReason ||
      typeof body.overrideReason !== "string" ||
      body.overrideReason.trim().length === 0
    ) {
      res.status(400).json({ error: "overrideReason is required — clinical justification is mandatory" });
      return;
    }

    const existingEvent = await prisma.triageEvent.findUnique({
      where: { id: body.triageEventId },
      include: { patient: true },
    });

    if (!existingEvent) {
      res.status(404).json({ error: `TriageEvent not found: ${body.triageEventId}` });
      return;
    }

    const originalLevelNum = LEVEL_NUM[existingEvent.aiSuggestedLevel];
    const newLevel = LEVEL_MAP[body.overrideLevel];

    if (!newLevel) {
      res.status(400).json({ error: "Invalid overrideLevel" });
      return;
    }

    if (existingEvent.aiSuggestedLevel === newLevel) {
      res.status(400).json({ error: "overrideLevel is the same as the current level — no change needed" });
      return;
    }

    const action: AuditAction =
      body.overrideLevel < originalLevelNum
        ? AuditAction.ESCALATE
        : AuditAction.DOWNGRADE;

    // Atomic transaction: update the triage level + create audit log
    const [updatedEvent, auditLog] = await prisma.$transaction([
      prisma.triageEvent.update({
        where: { id: body.triageEventId },
        data: { aiSuggestedLevel: newLevel },
        include: { patient: true },
      }),
      prisma.auditLog.create({
        data: {
          triageEventId: body.triageEventId,
          clinicianId: "CHARGE-NURSE-001",
          clinicianName: "Charge Nurse (Prototype)",
          clinicianRole: "Charge Nurse",
          originalAiLevel: existingEvent.aiSuggestedLevel,
          overrideLevel: newLevel,
          action,
          overrideReason: body.overrideReason.trim(),
          metadata: toJsonValue({}),
        },
      }),
    ]);

    res.json({
      triageEvent: {
        id: updatedEvent.id,
        patientId: updatedEvent.patientId,
        aiSuggestedLevel: updatedEvent.aiSuggestedLevel,
        aiConfidenceScore: updatedEvent.aiConfidenceScore,
        suggestedActions: updatedEvent.suggestedActions,
        status: updatedEvent.status,
        triageTime: updatedEvent.triageTime,
      },
      auditLog: {
        id: auditLog.id,
        clinicianRole: auditLog.clinicianRole,
        originalAiLevel: auditLog.originalAiLevel,
        overrideLevel: auditLog.overrideLevel,
        action: auditLog.action,
        overrideReason: auditLog.overrideReason,
        createdAt: auditLog.createdAt,
      },
      patient: updatedEvent.patient,
    });
  } catch (error) {
    console.error("Override failed:", error);
    res.status(500).json({ error: "Internal server error during triage override" });
  }
});

// ---------------------------------------------------------------------------
// Status Update
// ---------------------------------------------------------------------------

router.patch("/status", async (req: Request, res: Response) => {
  try {
    const { triageEventId, status } = req.body;

    if (!triageEventId) {
      res.status(400).json({ error: "triageEventId is required" });
      return;
    }

    if (!Object.values(TriageStatus).includes(status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    const updatedEvent = await prisma.triageEvent.update({
      where: { id: triageEventId },
      data: { status },
      include: { patient: true },
    });

    res.json({ triageEvent: updatedEvent });
  } catch (error) {
    console.error("Status update failed:", error);
    res.status(500).json({ error: "Internal server error updating triage status" });
  }
});

export default router;

