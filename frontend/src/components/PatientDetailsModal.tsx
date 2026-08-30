import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Modal,
  TextField,
  Typography,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import UpdateIcon from "@mui/icons-material/Update";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import type { QueueEntry, TriageAssessRequest } from "../types/triage";
import { formatPatientName } from "../types/triage";
import { assessPatient } from "../services/api";
import "./PatientDetailsModal.css";

interface PatientDetailsModalProps {
  entry: QueueEntry | null;
  open: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

const DEFAULT_VITALS = {
  heartRateBpm: "",
  bloodPressure: "",
  temperatureCelsius: "",
  respiratoryRate: "",
  oxygenSaturationPct: "",
  painScore: "",
};

export default function PatientDetailsModal({
  entry,
  open,
  onClose,
  onRefresh,
}: PatientDetailsModalProps) {
  const [isReassessing, setIsReassessing] = useState(false);
  const [vitals, setVitals] = useState(DEFAULT_VITALS);
  const [symptomsText, setSymptomsText] = useState("");
  const [presentationNotes, setPresentationNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetReassessForm = () => {
    setVitals(DEFAULT_VITALS);
    setSymptomsText("");
    setPresentationNotes("");
    setError(null);
  };

  const startReassessing = () => {
    resetReassessForm();
    setIsReassessing(true);
  };

  const handleClose = () => {
    setIsReassessing(false);
    onClose();
  };

  if (!entry) return null;

  const { patient, triageEvent } = entry;
  // Type casting for medical history/allergies/meds to avoid strict TS errors on unknown[]
  const medicalHistory = (patient.medicalHistory as Record<string, string | undefined>[]) || [];
  const allergies = (patient.allergies as Record<string, string | undefined>[]) || [];
  const medications = (patient.medications as Record<string, string | undefined>[]) || [];

  const updateVital = (field: keyof typeof DEFAULT_VITALS, value: string) => {
    setVitals((prev) => ({ ...prev, [field]: value }));
  };

  const handleReassessSubmit = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    setError(null);

    const symptoms = symptomsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (symptoms.length === 0) {
      setError("Enter at least one symptom (comma-separated).");
      return;
    }

    const payload: TriageAssessRequest = {
      patientId: patient.id,
      status: "REASSESSMENT",
      vitalSigns: {
        heartRateBpm: Number.parseFloat(vitals.heartRateBpm) || 0,
        bloodPressure: vitals.bloodPressure,
        temperatureCelsius: Number.parseFloat(vitals.temperatureCelsius) || 0,
        respiratoryRate: Number.parseFloat(vitals.respiratoryRate) || 0,
        oxygenSaturationPct: Number.parseFloat(vitals.oxygenSaturationPct) || 0,
        painScore: Number.parseFloat(vitals.painScore) || 0,
      },
      symptoms,
      presentationNotes: presentationNotes || undefined,
    };

    setSubmitting(true);
    try {
      await assessPatient(payload);
      onClose();
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-assessment failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <Box className="details-modal">
        <Box className="details-modal__header" sx={{ justifyContent: "space-between" }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <PersonIcon className="details-modal__icon" />
            <Typography variant="h6" component="h2">
              {isReassessing ? "Re-assess Patient" : "Patient Details"}
            </Typography>
          </Box>
          <Box>
            {isReassessing ? (
              <Button
                variant="outlined"
                size="small"
                startIcon={<ArrowBackIcon />}
                onClick={() => setIsReassessing(false)}
              >
                Back to Details
              </Button>
            ) : (
              <Button
                variant="contained"
                size="small"
                color="primary"
                startIcon={<UpdateIcon />}
                onClick={startReassessing}
              >
                Re-assess Patient
              </Button>
            )}
          </Box>
        </Box>

        {isReassessing ? (
          <Box component="form" onSubmit={handleReassessSubmit} className="intake-form">
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            
            <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
              Enter fresh vital signs and updated symptoms for <strong>{formatPatientName(patient)}</strong>.
            </Typography>

            <Typography variant="subtitle2" className="intake-form__section">
              New Vital Signs
            </Typography>
            <Box className="intake-form__row">
              <TextField
                label="Heart Rate (bpm)"
                type="number"
                value={vitals.heartRateBpm}
                onChange={(e) => updateVital("heartRateBpm", e.target.value)}
                required
                fullWidth
                size="small"
              />
              <TextField
                label="Blood Pressure"
                value={vitals.bloodPressure}
                onChange={(e) => updateVital("bloodPressure", e.target.value)}
                placeholder="120/80"
                required
                fullWidth
                size="small"
              />
            </Box>
            <Box className="intake-form__row">
              <TextField
                label="Temp (°C)"
                type="number"
                slotProps={{ htmlInput: { step: 0.1 } }}
                value={vitals.temperatureCelsius}
                onChange={(e) => updateVital("temperatureCelsius", e.target.value)}
                required
                fullWidth
                size="small"
              />
              <TextField
                label="Resp Rate"
                type="number"
                value={vitals.respiratoryRate}
                onChange={(e) => updateVital("respiratoryRate", e.target.value)}
                required
                fullWidth
                size="small"
              />
            </Box>
            <Box className="intake-form__row">
              <TextField
                label="SpO2 (%)"
                type="number"
                value={vitals.oxygenSaturationPct}
                onChange={(e) => updateVital("oxygenSaturationPct", e.target.value)}
                required
                fullWidth
                size="small"
              />
              <TextField
                label="Pain (0–10)"
                type="number"
                slotProps={{ htmlInput: { min: 0, max: 10 } }}
                value={vitals.painScore}
                onChange={(e) => updateVital("painScore", e.target.value)}
                required
                fullWidth
                size="small"
              />
            </Box>

            <Divider sx={{ my: 1 }} />

            <Typography variant="subtitle2" className="intake-form__section">
              Current Presentation
            </Typography>
            <TextField
              label="Symptoms (comma-separated)"
              value={symptomsText}
              onChange={(e) => setSymptomsText(e.target.value)}
              required
              fullWidth
              size="small"
              placeholder="e.g. Worsening shortness of breath"
              multiline
              minRows={2}
            />
            <TextField
              label="Re-assessment Notes"
              value={presentationNotes}
              onChange={(e) => setPresentationNotes(e.target.value)}
              fullWidth
              size="small"
              multiline
              minRows={2}
              sx={{ mt: 1.5 }}
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={submitting}
              sx={{ mt: 2 }}
            >
              {submitting ? "Submitting..." : "Submit Re-assessment"}
            </Button>
          </Box>
        ) : (
          <>
            <Box className="details-modal__demographics">
              <Typography variant="h6">{formatPatientName(patient)}</Typography>
              <Box className="details-modal__demographics-grid">
                <Typography variant="body2">
                  <strong>MRN:</strong> {patient.mrn || "N/A"}
                </Typography>
                <Typography variant="body2">
                  <strong>DOB:</strong>{" "}
                  {patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : "N/A"}
                </Typography>
                <Typography variant="body2">
                  <strong>Age Group:</strong> {patient.ageGroup || "N/A"}
                </Typography>
                <Typography variant="body2">
                  <strong>Sex:</strong> {patient.sex || "N/A"}
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              Vital Signs (from last triage)
            </Typography>
            <Box className="details-modal__vitals-grid">
              <Box className="vitals-card">
                <Typography variant="caption" color="text.secondary">HR</Typography>
                <Typography variant="body1">{triageEvent.vitalSigns?.heartRateBpm ?? "N/A"} bpm</Typography>
              </Box>
              <Box className="vitals-card">
                <Typography variant="caption" color="text.secondary">BP</Typography>
                <Typography variant="body1">{triageEvent.vitalSigns?.bloodPressure || "N/A"}</Typography>
              </Box>
              <Box className="vitals-card">
                <Typography variant="caption" color="text.secondary">Temp</Typography>
                <Typography variant="body1">{triageEvent.vitalSigns?.temperatureCelsius ?? "N/A"} °C</Typography>
              </Box>
              <Box className="vitals-card">
                <Typography variant="caption" color="text.secondary">RR</Typography>
                <Typography variant="body1">{triageEvent.vitalSigns?.respiratoryRate ?? "N/A"}</Typography>
              </Box>
              <Box className="vitals-card">
                <Typography variant="caption" color="text.secondary">SpO2</Typography>
                <Typography variant="body1">{triageEvent.vitalSigns?.oxygenSaturationPct ?? "N/A"}%</Typography>
              </Box>
              <Box className="vitals-card">
                <Typography variant="caption" color="text.secondary">Pain</Typography>
                <Typography variant="body1">{triageEvent.vitalSigns?.painScore ?? "N/A"}/10</Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              Presentation
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Symptoms:</Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {triageEvent.symptoms && triageEvent.symptoms.length > 0 ? (
                  triageEvent.symptoms.map((s, i) => (
                    <Chip key={i} label={s} size="small" />
                  ))
                ) : (
                  <Typography variant="body2">None recorded</Typography>
                )}
              </Box>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Notes:</Typography>
              <Typography variant="body2">
                {triageEvent.presentationNotes || "None recorded"}
              </Typography>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              Medical History
            </Typography>
            <Box className="details-modal__history-grid">
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Conditions:</Typography>
                {medicalHistory.length > 0 ? (
                  <ul className="details-list">
                    {medicalHistory.map((item, i) => (
                      <li key={i}>{item?.condition || "Unknown"} {item?.notes ? `(${item.notes})` : ""}</li>
                    ))}
                  </ul>
                ) : (
                  <Typography variant="body2">None recorded</Typography>
                )}
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Allergies:</Typography>
                {allergies.length > 0 ? (
                  <ul className="details-list">
                    {allergies.map((item, i) => (
                      <li key={i}>{item?.allergen || "Unknown"} {item?.reaction ? `(${item.reaction})` : ""}</li>
                    ))}
                  </ul>
                ) : (
                  <Typography variant="body2">None recorded</Typography>
                )}
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Medications:</Typography>
                {medications.length > 0 ? (
                  <ul className="details-list">
                    {medications.map((item, i) => (
                      <li key={i}>{item?.name || "Unknown"} {item?.dosage ? `(${item.dosage})` : ""}</li>
                    ))}
                  </ul>
                ) : (
                  <Typography variant="body2">None recorded</Typography>
                )}
              </Box>
            </Box>
          </>
        )}
      </Box>
    </Modal>
  );
}
