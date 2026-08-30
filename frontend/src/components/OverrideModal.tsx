import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Modal,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import GavelIcon from "@mui/icons-material/Gavel";
import type { QueueEntry, TriageLevel } from "../types/triage";
import { formatPatientName, triageLevelToNumber } from "../types/triage";
import { overrideTriageLevel } from "../services/api";
import "./OverrideModal.css";

interface OverrideModalProps {
  entry: QueueEntry | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ALL_LEVELS: { value: number; label: string; prisma: TriageLevel }[] = [
  { value: 1, label: "Level 1 — Resuscitation", prisma: "LEVEL_1" },
  { value: 2, label: "Level 2 — Emergent", prisma: "LEVEL_2" },
  { value: 3, label: "Level 3 — Urgent", prisma: "LEVEL_3" },
  { value: 4, label: "Level 4 — Less Urgent", prisma: "LEVEL_4" },
  { value: 5, label: "Level 5 — Non-Urgent", prisma: "LEVEL_5" },
];

export default function OverrideModal({
  entry,
  open,
  onClose,
  onSuccess,
}: OverrideModalProps) {
  const [newLevel, setNewLevel] = useState<number | "">("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!entry) return null;

  const currentLevelNum = triageLevelToNumber(entry.triageEvent.aiSuggestedLevel);

  const handleClose = () => {
    setNewLevel("");
    setReason("");
    setError(null);
    setSubmitting(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (newLevel === "") {
      setError("Select a new triage level.");
      return;
    }
    if (!reason.trim()) {
      setError("Clinical justification is mandatory for audit compliance.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await overrideTriageLevel({
        triageEventId: entry.triageEvent.id,
        overrideLevel: newLevel,
        overrideReason: reason.trim(),
      });
      handleClose();
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Override failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <Box className="override-modal">
        <Box className="override-modal__header">
          <GavelIcon className="override-modal__icon" />
          <Typography variant="h6" component="h2">
            Clinician Override
          </Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          You are overriding the AI triage assessment. A justification is
          required for HIPAA audit compliance.
        </Typography>

        <Box className="override-modal__patient-info">
          <Typography variant="subtitle2">
            {formatPatientName(entry.patient)}
          </Typography>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Typography variant="body2" color="text.secondary">
              Current AI Level:
            </Typography>
            <Chip
              label={`Level ${currentLevelNum}`}
              size="small"
              color={currentLevelNum <= 2 ? "error" : currentLevelNum === 3 ? "warning" : "default"}
            />
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>New Triage Level</InputLabel>
          <Select
            label="New Triage Level"
            value={newLevel}
            onChange={(e) => setNewLevel(e.target.value as number)}
          >
            {ALL_LEVELS.filter((l) => l.value !== currentLevelNum).map((l) => (
              <MenuItem key={l.value} value={l.value}>
                {l.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Clinical Justification (required)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          fullWidth
          multiline
          minRows={3}
          size="small"
          placeholder="Describe the clinical reasoning for this override…"
          sx={{ mb: 2.5 }}
        />

        <Box className="override-modal__actions">
          <Button variant="outlined" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleSubmit}
            disabled={submitting || newLevel === "" || !reason.trim()}
            startIcon={<GavelIcon />}
          >
            {submitting ? "Submitting…" : "Confirm Override"}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}
