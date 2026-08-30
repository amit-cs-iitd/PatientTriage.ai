import type { Prisma } from "@prisma/client";

export interface VitalSigns {
  heartRateBpm: number;
  bloodPressure: string;
  temperatureCelsius: number;
  respiratoryRate: number;
  oxygenSaturationPct: number;
  painScore: number;
}

export interface MedicalHistoryItem {
  condition: string;
  diagnosedYear?: number;
  notes?: string;
}

export interface AllergyItem {
  allergen: string;
  reaction?: string;
}

export interface MedicationItem {
  name: string;
  dosage?: string;
  frequency?: string;
}

export interface AuditLogMetadata {
  ipAddress?: string;
  sessionId?: string;
  suggestedActionsBefore?: string[];
  suggestedActionsAfter?: string[];
}

export type FlowAction =
  | "ORDER_ECG"
  | "ORDER_X_RAY"
  | "ORDER_CT"
  | "DRAW_TROPONIN"
  | "DRAW_CBC"
  | "DRAW_BMP"
  | "PREPARE_BED_1"
  | "PREPARE_BED_2"
  | "PREPARE_BED_3"
  | "NOTIFY_ATTENDING"
  | "NOTIFY_CHARGE_NURSE"
  | "CLINICIAN_REVIEW"
  | "REPEAT_VITALS_15MIN"
  | "REPEAT_VITALS_30MIN"
  | "IV_ACCESS"
  | "OXYGEN_THERAPY"
  | "PEDIATRIC_CONSULT"
  | "GERIATRIC_CONSULT";

export function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function parseVitalSigns(json: Prisma.JsonValue): VitalSigns {
  return json as unknown as VitalSigns;
}

export function parseMedicalHistory(
  json: Prisma.JsonValue,
): MedicalHistoryItem[] {
  return json as unknown as MedicalHistoryItem[];
}

export function parseAllergies(json: Prisma.JsonValue): AllergyItem[] {
  return json as unknown as AllergyItem[];
}

export function parseMedications(json: Prisma.JsonValue): MedicationItem[] {
  return json as unknown as MedicationItem[];
}

export function parseSuggestedActions(json: Prisma.JsonValue): FlowAction[] {
  return json as unknown as FlowAction[];
}

export function parseAuditLogMetadata(
  json: Prisma.JsonValue,
): AuditLogMetadata {
  return json as unknown as AuditLogMetadata;
}

export function dobFromAge(ageYears: number, referenceDate = new Date()): Date {
  const dob = new Date(referenceDate);
  dob.setFullYear(dob.getFullYear() - ageYears);
  dob.setMonth(0);
  dob.setDate(1);
  return dob;
}

export function minutesAgo(minutes: number, referenceDate = new Date()): Date {
  return new Date(referenceDate.getTime() - minutes * 60 * 1000);
}
