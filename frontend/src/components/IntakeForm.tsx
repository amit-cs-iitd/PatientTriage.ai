import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import type { AgeGroup, Patient, Sex, TriageAssessRequest } from "../types/triage";
import { assessPatient, lookupPatientByMrn } from "../services/api";
import "./IntakeForm.css";

interface IntakeFormProps {
  onSuccess: () => void;
}

const DEFAULT_VITALS = {
  heartRateBpm: 80,
  bloodPressure: "120/80",
  temperatureCelsius: 37.0,
  respiratoryRate: 16,
  oxygenSaturationPct: 98,
  painScore: 0,
};

function generateMrn(): string {
  return `MRN-${Date.now().toString().slice(-8)}`;
}

export default function IntakeForm({ onSuccess }: IntakeFormProps) {
  const [lookupMrn, setLookupMrn] = useState("");
  const [foundPatient, setFoundPatient] = useState<Patient | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [mrn, setMrn] = useState(generateMrn());
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sex, setSex] = useState<Sex>("UNKNOWN");
  const [ageGroup, setAgeGroup] = useState<AgeGroup>("ADULT");
  const [isFirstVisit, setIsFirstVisit] = useState(true);
  const [medicalHistoryText, setMedicalHistoryText] = useState("");
  const [symptomsText, setSymptomsText] = useState("");
  const [presentationNotes, setPresentationNotes] = useState("");
  const [vitals, setVitals] = useState(DEFAULT_VITALS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [snackbarError, setSnackbarError] = useState<string | null>(null);

  const updateVital = (field: keyof typeof DEFAULT_VITALS, value: string) => {
    setVitals((prev) => ({
      ...prev,
      [field]:
        field === "bloodPressure"
          ? value
          : Number.parseFloat(value) || 0,
    }));
  };

  const handleLookup = async () => {
    if (!lookupMrn.trim()) return;
    setLookupLoading(true);
    setLookupError(null);
    setSuccess(null);
    setError(null);
    try {
      const { patient } = await lookupPatientByMrn(lookupMrn.trim());
      setFoundPatient(patient);
      setMrn(patient.mrn);
      setFirstName(patient.firstName);
      setLastName(patient.lastName);
      setDateOfBirth(new Date(patient.dateOfBirth).toISOString().split("T")[0]);
      setSex(patient.sex);
      setAgeGroup(patient.ageGroup);
      setIsFirstVisit(patient.isFirstVisit);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_err) {
      setLookupError("Patient not found");
      setFoundPatient(null);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleReset = () => {
    setFoundPatient(null);
    setLookupMrn("");
    setMrn(generateMrn());
    setFirstName("");
    setLastName("");
    setDateOfBirth("");
    setSex("UNKNOWN");
    setAgeGroup("ADULT");
    setIsFirstVisit(true);
    setMedicalHistoryText("");
    setSymptomsText("");
    setPresentationNotes("");
    setVitals(DEFAULT_VITALS);
    setError(null);
    setSuccess(null);
    setLookupError(null);
  };

  const handleSubmit = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const symptoms = symptomsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (symptoms.length === 0) {
      setError("Enter at least one symptom (comma-separated).");
      return;
    }

    const parsedMedicalHistory = !isFirstVisit && medicalHistoryText.trim()
      ? medicalHistoryText.split(",").map(c => ({ condition: c.trim() })).filter(c => c.condition)
      : undefined;

    const payload: TriageAssessRequest = {
      patientId: foundPatient?.id,
      mrn,
      firstName,
      lastName,
      dateOfBirth,
      sex,
      ageGroup,
      isFirstVisit,
      vitalSigns: vitals,
      symptoms,
      presentationNotes: presentationNotes || undefined,
      medicalHistory: parsedMedicalHistory,
    };

    setSubmitting(true);
    try {
      const result = await assessPatient(payload);
      setSuccess(
        `Assessed ${result.patient.firstName} ${result.patient.lastName} — Level ${result.assessment.triageLevel}`,
      );
      if (!foundPatient) {
        setMrn(generateMrn());
      }
      setSymptomsText("");
      setPresentationNotes("");
      setVitals(DEFAULT_VITALS);
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Assessment failed";
      if (msg.includes("MRN already exists")) {
        setSnackbarError(msg);
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isLocked = foundPatient !== null;

  return (
    <Paper className="intake-panel" elevation={2}>
      <Box className="intake-panel__header" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" component="h2">
            Patient Intake
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Submit vitals and symptoms for AI triage assessment
          </Typography>
        </Box>
        {isLocked && (
          <Button size="small" variant="outlined" color="primary" onClick={handleReset} startIcon={<ClearIcon />}>
            New Patient
          </Button>
        )}
      </Box>

      <Box component="form" onSubmit={handleSubmit} className="intake-form">
        {!isLocked && (
          <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
            <TextField
              label="MRN Lookup"
              value={lookupMrn}
              onChange={(e) => setLookupMrn(e.target.value)}
              size="small"
              placeholder="Enter returning MRN"
              sx={{ flexGrow: 1 }}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleLookup())}
            />
            <Button
              variant="contained"
              onClick={handleLookup}
              disabled={lookupLoading || !lookupMrn.trim()}
              startIcon={<SearchIcon />}
            >
              Find
            </Button>
          </Box>
        )}
        
        {lookupError && <Alert severity="warning" sx={{ mb: 2 }}>{lookupError}</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        <Typography variant="subtitle2" className="intake-form__section">
          Demographics {isLocked && "(Locked)"}
        </Typography>
        <TextField
          label="MRN"
          value={mrn}
          onChange={(e) => setMrn(e.target.value)}
          required
          fullWidth
          size="small"
          disabled={isLocked}
        />
        <Box className="intake-form__row">
          <TextField
            label="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            fullWidth
            size="small"
            disabled={isLocked}
          />
          <TextField
            label="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            fullWidth
            size="small"
            disabled={isLocked}
          />
        </Box>
        <TextField
          label="Date of Birth"
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          required
          fullWidth
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
          disabled={isLocked}
        />
        <Box className="intake-form__row">
          <FormControl fullWidth size="small" disabled={isLocked}>
            <InputLabel>Sex</InputLabel>
            <Select
              label="Sex"
              value={sex}
              onChange={(e) => setSex(e.target.value as Sex)}
            >
              <MenuItem value="MALE">Male</MenuItem>
              <MenuItem value="FEMALE">Female</MenuItem>
              <MenuItem value="OTHER">Other</MenuItem>
              <MenuItem value="UNKNOWN">Unknown</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth size="small" disabled={isLocked}>
            <InputLabel>Age Group</InputLabel>
            <Select
              label="Age Group"
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value as AgeGroup)}
            >
              <MenuItem value="PEDIATRIC">Pediatric</MenuItem>
              <MenuItem value="ADULT">Adult</MenuItem>
              <MenuItem value="GERIATRIC">Geriatric</MenuItem>
            </Select>
          </FormControl>
        </Box>
        {!isLocked && (
          <Box sx={{ mt: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={isFirstVisit}
                  onChange={(e) => setIsFirstVisit(e.target.checked)}
                />
              }
              label="First visit (no prior medical history)"
            />
            {!isFirstVisit && (
              <TextField
                label="Past Medical Conditions (Comma separated)"
                value={medicalHistoryText}
                onChange={(e) => setMedicalHistoryText(e.target.value)}
                fullWidth
                size="small"
                multiline
                minRows={2}
                sx={{ mt: 1 }}
                placeholder="e.g. Hypertension, Asthma"
              />
            )}
          </Box>
        )}

        <Divider sx={{ my: 1 }} />

        <Typography variant="subtitle2" className="intake-form__section">
          Vital Signs
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
          Presentation
        </Typography>
        <TextField
          label="Symptoms (comma-separated)"
          value={symptomsText}
          onChange={(e) => setSymptomsText(e.target.value)}
          required
          fullWidth
          size="small"
          placeholder="Chest pain, Shortness of breath"
          multiline
          minRows={2}
        />
        <TextField
          label="Presentation Notes"
          value={presentationNotes}
          onChange={(e) => setPresentationNotes(e.target.value)}
          fullWidth
          size="small"
          multiline
          minRows={2}
        />

        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disabled={submitting}
          sx={{ mt: 1 }}
        >
          {submitting ? "Assessing…" : (isLocked ? "Run Triage Re-assessment" : "Run Triage Assessment")}
        </Button>
      </Box>

      <Snackbar
        open={snackbarError !== null}
        autoHideDuration={8000}
        onClose={() => setSnackbarError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setSnackbarError(null)} severity="error" variant="filled" sx={{ width: "100%" }}>
          {snackbarError}
        </Alert>
      </Snackbar>
    </Paper>
  );
}
