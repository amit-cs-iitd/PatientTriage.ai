import type {
  OverrideRequest,
  OverrideResponse,
  QueueResponse,
  TriageAssessRequest,
  TriageAssessResponse,
  TriageEvent,
  TriageStatus,
  Patient,
} from "../types/triage";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function fetchQueue(): Promise<QueueResponse> {
  return request<QueueResponse>("/api/triage/queue");
}

export function lookupPatientByMrn(mrn: string): Promise<{ patient: Patient }> {
  return request<{ patient: Patient }>(`/api/triage/patient/${mrn}`);
}

export function assessPatient(
  payload: TriageAssessRequest,
): Promise<TriageAssessResponse> {
  return request<TriageAssessResponse>("/api/triage/assess", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function overrideTriageLevel(
  payload: OverrideRequest,
): Promise<OverrideResponse> {
  return request<OverrideResponse>("/api/triage/override", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateTriageStatus(
  payload: { triageEventId: string; status: TriageStatus },
): Promise<{ triageEvent: TriageEvent }> {
  return request<{ triageEvent: TriageEvent }>("/api/triage/status", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}


