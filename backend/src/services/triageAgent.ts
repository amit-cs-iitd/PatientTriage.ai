import { AgeGroup, TriageLevel } from "@prisma/client";
import type {
  FlowAction,
  MedicalHistoryItem,
  VitalSigns,
} from "../types";

// Types

export interface SafetyAgentInput {
  vitalSigns: VitalSigns;
  ageGroup: AgeGroup;
  medicalHistory: MedicalHistoryItem[];
  symptoms: string[];
  isFirstVisit: boolean;
  presentationNotes?: string;
}

export interface SafetyAgentResult {
  triageLevel: 1 | 2 | 3 | 4 | 5;
  aiConfidenceScore: number;
  uncertaintyReason: string | null;
}

export interface FlowAgentInput {
  symptoms: string[];
  ageGroup: AgeGroup;
  triageLevel: 1 | 2 | 3 | 4 | 5;
  vitalSigns: VitalSigns;
}

export interface FlowAgentResult {
  suggestedActions: FlowAction[];
}

export interface TriageAssessmentResult {
  safety: SafetyAgentResult;
  flow: FlowAgentResult;
}

// Age-group vital sign thresholds (explicit rule blocks)

interface VitalThresholdBlock {
  heartRateCriticalHigh: number;
  heartRateHigh: number;
  heartRateLow: number;
  feverCelsius: number;
  highFeverCelsius: number;
  hypothermiaCelsius: number;
  respRateHigh: number;
  respRateCriticalHigh: number;
  spo2Critical: number;
  spo2Low: number;
  systolicHypotension: number;
  diastolicHypotension: number;
  painSevere: number;
}

const VITAL_THRESHOLDS: Record<AgeGroup, VitalThresholdBlock> = {
  PEDIATRIC: {
    heartRateCriticalHigh: 160,
    heartRateHigh: 130,
    heartRateLow: 60,
    feverCelsius: 38.0,
    highFeverCelsius: 39.5,
    hypothermiaCelsius: 36.0,
    respRateHigh: 28,
    respRateCriticalHigh: 40,
    spo2Critical: 90,
    spo2Low: 94,
    systolicHypotension: 70,
    diastolicHypotension: 40,
    painSevere: 7,
  },
  ADULT: {
    heartRateCriticalHigh: 130,
    heartRateHigh: 110,
    heartRateLow: 50,
    feverCelsius: 38.3,
    highFeverCelsius: 39.5,
    hypothermiaCelsius: 35.5,
    respRateHigh: 24,
    respRateCriticalHigh: 30,
    spo2Critical: 88,
    spo2Low: 92,
    systolicHypotension: 90,
    diastolicHypotension: 60,
    painSevere: 8,
  },
  GERIATRIC: {
    heartRateCriticalHigh: 120,
    heartRateHigh: 100,
    heartRateLow: 55,
    feverCelsius: 37.8,
    highFeverCelsius: 38.5,
    hypothermiaCelsius: 36.0,
    respRateHigh: 22,
    respRateCriticalHigh: 28,
    spo2Critical: 90,
    spo2Low: 94,
    systolicHypotension: 100,
    diastolicHypotension: 60,
    painSevere: 6,
  },
};

// Symptom pattern rules

const HIGH_RISK_SYMPTOM_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /crush(ing)?\s+chest\s+pain|stemi|acs/i, label: "Suspected acute coronary syndrome" },
  { pattern: /chest\s+pain|radiation\s+to\s+(left\s+)?arm/i, label: "Chest pain presentation" },
  { pattern: /shortness\s+of\s+breath|dyspnea|respiratory\s+distress/i, label: "Respiratory distress" },
  { pattern: /syncope|loss\s+of\s+consciousness|unresponsive/i, label: "Altered consciousness or syncope" },
  { pattern: /seizure|post-ictal|convuls/i, label: "Seizure activity" },
  { pattern: /anaphylaxis|throat\s+tightness|angioedema/i, label: "Allergic emergency" },
  { pattern: /overdose|opioid|pinpoint\s+pupils/i, label: "Suspected overdose" },
  { pattern: /suicidal|self[- ]?harm/i, label: "Behavioral emergency" },
  { pattern: /stroke|facial\s+droop|slurred\s+speech|weakness/i, label: "Suspected stroke" },
];

const AMBIGUOUS_SYMPTOM_PATTERNS: { pattern: RegExp; label: string }[] = [
  {
    pattern: /headache.*(neck\s+stiff|photophob)|thunderclap|worst\s+headache/i,
    label: "Headache with features overlapping SAH and primary headache",
  },
  {
    pattern: /chest\s+(discomfort|pressure).*(epigastric|abdomen)|epigastric.*(chest|discomfort)/i,
    label: "Overlapping cardiac and GI presentation",
  },
  {
    pattern: /syncope|dizziness/i,
    label: "Syncope or dizziness with potentially normal vitals — cardiac vs benign cause unclear",
  },
  {
    pattern: /abdominal\s+pain|rlq|appendic/i,
    label: "Abdominal pain — surgical vs medical cause unclear at intake",
  },
  {
    pattern: /confusion|altered\s+mental|delirium/i,
    label: "Acute confusion — broad differential including infection and metabolic causes",
  },
];

const HIGH_RISK_HISTORY_KEYWORDS = [
  "atrial fibrillation",
  "anticoagul",
  "warfarin",
  "copd",
  "chf",
  "heart failure",
  "diabetes",
  "epilepsy",
  "immunosupp",
  "cancer",
  "dementia",
];

// Helpers

function parseBP(bp: string): { systolic: number; diastolic: number } | null {
  const match = bp.match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
  if (!match) return null;
  return {
    systolic: Number.parseInt(match[1], 10),
    diastolic: Number.parseInt(match[2], 10)
  };
}

function clampLevel(level: number): 1 | 2 | 3 | 4 | 5 {
  return Math.max(1, Math.min(5, Math.round(level))) as 1 | 2 | 3 | 4 | 5;
}

function escalateLevel(level: number, steps = 1): 1 | 2 | 3 | 4 | 5 {
  return clampLevel(level - steps);
}

function normalizeSymptoms(symptoms: string[]): string {
  return symptoms.join(" ").toLowerCase();
}

function matchPatterns(
  text: string,
  patterns: { pattern: RegExp; label: string }[],
): string[] {
  return patterns
    .filter(({ pattern }) => pattern.test(text))
    .map(({ label }) => label);
}

function hasHighRiskHistory(history: MedicalHistoryItem[]): boolean {
  const blob = history
    .map((item) => `${item.condition} ${item.notes ?? ""}`)
    .join(" ")
    .toLowerCase();
  return HIGH_RISK_HISTORY_KEYWORDS.some((keyword) => blob.includes(keyword));
}

function isVitalSignsIncomplete(vitals: VitalSigns): boolean {
  return (
    vitals.heartRateBpm <= 0 ||
    vitals.respiratoryRate <= 0 ||
    vitals.oxygenSaturationPct <= 0 ||
    vitals.temperatureCelsius <= 0 ||
    !vitals.bloodPressure ||
    parseBP(vitals.bloodPressure) === null
  );
}

export function toPrismaTriageLevel(level: 1 | 2 | 3 | 4 | 5): TriageLevel {
  const map: Record<number, TriageLevel> = {
    1: TriageLevel.LEVEL_1,
    2: TriageLevel.LEVEL_2,
    3: TriageLevel.LEVEL_3,
    4: TriageLevel.LEVEL_4,
    5: TriageLevel.LEVEL_5,
  };
  return map[level];
}

export function fromPrismaTriageLevel(level: TriageLevel): 1 | 2 | 3 | 4 | 5 {
  const map: Record<TriageLevel, 1 | 2 | 3 | 4 | 5> = {
    [TriageLevel.LEVEL_1]: 1,
    [TriageLevel.LEVEL_2]: 2,
    [TriageLevel.LEVEL_3]: 3,
    [TriageLevel.LEVEL_4]: 4,
    [TriageLevel.LEVEL_5]: 5,
  };
  return map[level];
}

// Safety Agent

export function runSafetyAgent(input: SafetyAgentInput): SafetyAgentResult {
  const { vitalSigns, ageGroup, medicalHistory, symptoms, isFirstVisit } =
    input;
  const thresholds = VITAL_THRESHOLDS[ageGroup];
  const symptomText = normalizeSymptoms(symptoms);
  const notesText = (input.presentationNotes ?? "").toLowerCase();
  const combinedText = `${symptomText} ${notesText}`;

  let level = 5;
  const uncertaintyReasons: string[] = [];
  let confidence = 0.92;

  // Vital sign rule blocks (age-adjusted)
  const bp = parseBP(vitalSigns.bloodPressure);

  if (vitalSigns.oxygenSaturationPct <= thresholds.spo2Critical) {
    level = Math.min(level, 1);
  } else if (vitalSigns.oxygenSaturationPct <= thresholds.spo2Low) {
    level = Math.min(level, 2);
  }

  if (vitalSigns.heartRateBpm >= thresholds.heartRateCriticalHigh) {
    level = Math.min(level, 1);
  } else if (vitalSigns.heartRateBpm >= thresholds.heartRateHigh) {
    level = Math.min(level, 2);
  } else if (vitalSigns.heartRateBpm <= thresholds.heartRateLow) {
    level = Math.min(level, 2);
  }

  if (vitalSigns.respiratoryRate >= thresholds.respRateCriticalHigh) {
    level = Math.min(level, 1);
  } else if (vitalSigns.respiratoryRate >= thresholds.respRateHigh) {
    level = Math.min(level, 2);
  }

  if (vitalSigns.temperatureCelsius >= thresholds.highFeverCelsius) {
    level = Math.min(level, 2);
  } else if (vitalSigns.temperatureCelsius >= thresholds.feverCelsius) {
    if (ageGroup === AgeGroup.PEDIATRIC) {
      level = Math.min(level, 3);
      uncertaintyReasons.push(
        "Pediatric fever threshold exceeded — age-adjusted urgency applied",
      );
      confidence -= 0.12;
    } else if (ageGroup === AgeGroup.GERIATRIC) {
      level = Math.min(level, 2);
      uncertaintyReasons.push(
        "Geriatric fever at lower threshold — infection or sepsis risk elevated",
      );
      confidence -= 0.1;
    } else {
      level = Math.min(level, 3);
    }
  }

  if (vitalSigns.temperatureCelsius <= thresholds.hypothermiaCelsius) {
    level = Math.min(level, 2);
  }

  if (bp !== null) {
    if (bp.systolic <= thresholds.systolicHypotension || bp.diastolic <= thresholds.diastolicHypotension) {
      level = Math.min(level, 1);
    }
  }

  if (vitalSigns.painScore >= thresholds.painSevere) {
    level = Math.min(level, 3);
    if (ageGroup === AgeGroup.GERIATRIC) {
      uncertaintyReasons.push(
        "Geriatric patient may under-report pain — severity bias applied",
      );
      confidence -= 0.08;
    }
  }

  // Symptom-based rules
  const highRiskMatches = matchPatterns(combinedText, HIGH_RISK_SYMPTOM_PATTERNS);
  if (highRiskMatches.length > 0) {
    level = Math.min(level, 2);
    if (highRiskMatches.some((m) => /acs|stemi|crush/i.test(m))) {
      level = 1;
    }
  }

  const ambiguousMatches = matchPatterns(combinedText, AMBIGUOUS_SYMPTOM_PATTERNS);
  if (ambiguousMatches.length > 0) {
    level = escalateLevel(level, 1);
    confidence -= 0.15 * ambiguousMatches.length;
    uncertaintyReasons.push(...ambiguousMatches);
  }

  // Medical history modifiers
  if (hasHighRiskHistory(medicalHistory)) {
    if (level > 3) level = 3;
    confidence += 0.03;
  }

  // Data completeness & first-visit safety bias
  if (isFirstVisit || medicalHistory.length === 0) {
    level = escalateLevel(level, 1);
    confidence -= 0.18;
    uncertaintyReasons.push(
      "First visit or no prior medical history — limited baseline data; escalating to avoid under-triage",
    );
  }

  if (isVitalSignsIncomplete(vitalSigns)) {
    level = escalateLevel(level, 1);
    confidence -= 0.2;
    uncertaintyReasons.push(
      "Incomplete vital signs at intake — defaulting to higher severity pending full assessment",
    );
  }

  if (symptoms.length === 0) {
    level = escalateLevel(level, 1);
    confidence -= 0.15;
    uncertaintyReasons.push(
      "No structured symptoms recorded — presentation ambiguous at intake",
    );
  }

  // Safety-first cap: never downgrade below level 3 when confidence is low
  confidence = Math.max(0.35, Math.min(0.98, confidence));
  if (confidence < 0.65 && level > 3) {
    level = 3;
    if (!uncertaintyReasons.some((r) => r.includes("Low confidence"))) {
      uncertaintyReasons.push(
        "Low confidence assessment — safety-first bias applied to avoid under-triage",
      );
    }
  }

  const triageLevel = clampLevel(level);
  const uniqueReasons = [...new Set(uncertaintyReasons)];

  return {
    triageLevel,
    aiConfidenceScore: Math.round(confidence * 100) / 100,
    uncertaintyReason:
      uniqueReasons.length > 0 ? uniqueReasons.join("; ") : null,
  };
}

// Flow Agent — parallel operational task scheduling

export function runFlowAgent(input: FlowAgentInput): FlowAgentResult {
  const { symptoms, ageGroup, triageLevel, vitalSigns } = input;
  const text = normalizeSymptoms(symptoms);
  const actions = new Set<FlowAction>();

  const isUrgent = triageLevel <= 2;
  const isModerate = triageLevel === 3;

  if (isUrgent) {
    actions.add("PREPARE_BED_1");
    actions.add("NOTIFY_ATTENDING");
    actions.add("IV_ACCESS");
  } else if (isModerate) {
    actions.add("PREPARE_BED_2");
    actions.add("NOTIFY_CHARGE_NURSE");
  } else {
    actions.add("PREPARE_BED_3");
  }

  actions.add("CLINICIAN_REVIEW");

  if (/chest\s+pain|crush|acs|stemi|palpitation|syncope/i.test(text)) {
    actions.add("ORDER_ECG");
    actions.add("DRAW_TROPONIN");
  }

  if (/shortness\s+of\s+breath|dyspnea|wheez|respiratory|copd/i.test(text)) {
    actions.add("OXYGEN_THERAPY");
    actions.add("ORDER_X_RAY");
  }

  if (/headache|thunderclap|neck\s+stiff|photophob|stroke|facial\s+droop/i.test(text)) {
    actions.add("ORDER_CT");
    actions.add("DRAW_CBC");
  }

  if (/abdominal|rlq|appendic|nausea|vomit/i.test(text)) {
    actions.add("ORDER_X_RAY");
    actions.add("DRAW_CBC");
    actions.add("DRAW_BMP");
  }

  if (/fall|fracture|trauma|laceration|ankle|swelling/i.test(text)) {
    actions.add("ORDER_X_RAY");
  }

  if (/fever|infection|confusion|sepsis/i.test(text)) {
    actions.add("DRAW_CBC");
    actions.add("DRAW_BMP");
  }

  if (/overdose|opioid|unresponsive|altered\s+mental/i.test(text)) {
    actions.add("IV_ACCESS");
    actions.add("DRAW_BMP");
    actions.add("REPEAT_VITALS_15MIN");
  }

  if (/anaphylaxis|allergic|urticaria|throat\s+tight/i.test(text)) {
    actions.add("IV_ACCESS");
    actions.add("OXYGEN_THERAPY");
    actions.add("REPEAT_VITALS_15MIN");
  }

  if (ageGroup === AgeGroup.PEDIATRIC) {
    actions.add("PEDIATRIC_CONSULT");
  }

  if (ageGroup === AgeGroup.GERIATRIC) {
    actions.add("GERIATRIC_CONSULT");
  }

  if (
    vitalSigns.oxygenSaturationPct < VITAL_THRESHOLDS[ageGroup].spo2Low ||
    vitalSigns.heartRateBpm >= VITAL_THRESHOLDS[ageGroup].heartRateHigh
  ) {
    actions.add("REPEAT_VITALS_15MIN");
  } else if (triageLevel >= 4) {
    actions.add("REPEAT_VITALS_30MIN");
  }

  return {
    suggestedActions: [...actions],
  };
}

export function runTriageAssessment(
  safetyInput: SafetyAgentInput,
  flowInput?: Omit<FlowAgentInput, "triageLevel">,
): TriageAssessmentResult {
  const safety = runSafetyAgent(safetyInput);
  const flow = runFlowAgent({
    symptoms: flowInput?.symptoms ?? safetyInput.symptoms,
    ageGroup: flowInput?.ageGroup ?? safetyInput.ageGroup,
    triageLevel: safety.triageLevel,
    vitalSigns: flowInput?.vitalSigns ?? safetyInput.vitalSigns,
  });
  return { safety, flow };
}
