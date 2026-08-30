export type AgeGroup = "PEDIATRIC" | "ADULT" | "GERIATRIC";
export type Sex = "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
export type TriageLevel =
  | "LEVEL_1"
  | "LEVEL_2"
  | "LEVEL_3"
  | "LEVEL_4"
  | "LEVEL_5";
export type TriageStatus =
  | "WAITING"
  | "IN_REVIEW"
  | "COMPLETED"
  | "REASSESSMENT";

export type AuditAction =
  | "ESCALATE"
  | "DOWNGRADE"
  | "MODIFY_ACTIONS"
  | "DISMISS_ALERT";

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

export interface VitalSigns {
  heartRateBpm: number;
  bloodPressure: string;
  temperatureCelsius: number;
  respiratoryRate: number;
  oxygenSaturationPct: number;
  painScore: number;
}

export interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: Sex;
  ageGroup: AgeGroup;
  medicalHistory: unknown[];
  allergies: unknown[];
  medications: unknown[];
  isFirstVisit: boolean;
  arrivalTime: string;
  createdAt: string;
  updatedAt: string;
}

export interface TriageEvent {
  id: string;
  patientId: string;
  aiSuggestedLevel: TriageLevel;
  aiConfidenceScore: number;
  suggestedActions: FlowAction[];
  vitalSigns: VitalSigns;
  symptoms: string[];
  presentationNotes: string;
  uncertaintyReason: string | null;
  status: TriageStatus;
  triageTime: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  clinicianRole: string;
  originalAiLevel: TriageLevel;
  overrideLevel: TriageLevel;
  action: AuditAction;
  overrideReason: string;
  createdAt: string;
}

export interface QueueEntry {
  patient: Patient;
  triageEvent: TriageEvent;
  latestAuditLog: AuditLog | null;
}

export interface QueueResponse {
  queue: QueueEntry[];
}

export interface TriageAssessRequest {
  patientId?: string;
  status?: TriageStatus;
  mrn?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  sex?: Sex;
  ageGroup?: AgeGroup;
  isFirstVisit?: boolean;
  vitalSigns: VitalSigns;
  symptoms: string[];
  presentationNotes?: string;
  medicalHistory?: unknown[];
}

export interface TriageAssessResponse {
  patient: Patient;
  triageEvent: TriageEvent;
  assessment: {
    triageLevel: number;
    aiConfidenceScore: number;
    uncertaintyReason: string | null;
    suggestedActions: FlowAction[];
  };
}

export interface OverrideRequest {
  triageEventId: string;
  overrideLevel: number;
  overrideReason: string;
}

export interface OverrideResponse {
  triageEvent: Pick<
    TriageEvent,
    | "id"
    | "patientId"
    | "aiSuggestedLevel"
    | "aiConfidenceScore"
    | "suggestedActions"
    | "status"
    | "triageTime"
  >;
  auditLog: AuditLog;
  patient: Patient;
}

export function triageLevelToNumber(level: TriageLevel): number {
  return Number.parseInt(level.replace("LEVEL_", ""), 10);
}

export function formatPatientName(patient: Patient): string {
  return `${patient.lastName}, ${patient.firstName}`;
}

