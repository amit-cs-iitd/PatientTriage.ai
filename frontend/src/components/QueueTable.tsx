import { useEffect, useState } from "react";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import RefreshIcon from "@mui/icons-material/Refresh";
import GavelIcon from "@mui/icons-material/Gavel";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import type { QueueEntry, TriageLevel } from "../types/triage";
import { formatPatientName, triageLevelToNumber } from "../types/triage";
import { updateTriageStatus } from "../services/api";
import OverrideModal from "./OverrideModal";
import PatientDetailsModal from "./PatientDetailsModal";
import "./QueueTable.css";

interface QueueTableProps {
  entries: QueueEntry[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  surgeMode: boolean;
}

const LEVEL_COLORS: Record<
  TriageLevel,
  "error" | "warning" | "info" | "success" | "default"
> = {
  LEVEL_1: "error",
  LEVEL_2: "warning",
  LEVEL_3: "info",
  LEVEL_4: "default",
  LEVEL_5: "success",
};

/** Wait-time thresholds (in minutes) used during surge simulation */
const SURGE_THRESHOLDS: Record<number, number> = {
  2: 10, // Level 2: > 10 min → danger
  3: 30, // Level 3: > 30 min → warning
};

function formatWaitTime(triageTimeStr: string, now: number): string {
  const elapsed = now - new Date(triageTimeStr).getTime();
  const totalMinutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h ${mins}m`;
}

function getWaitMinutes(triageTimeStr: string, now: number): number {
  const elapsed = now - new Date(triageTimeStr).getTime();
  return Math.max(0, Math.floor(elapsed / 60_000));
}

export default function QueueTable({
  entries,
  loading,
  error,
  onRefresh,
  surgeMode,
}: QueueTableProps) {
  const [overrideTarget, setOverrideTarget] = useState<QueueEntry | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<QueueEntry | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Tick currentTime every 30 s so wait-time and surge highlights update live
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const getSurgeRowClass = (entry: QueueEntry): string | undefined => {
    if (!surgeMode) return undefined;
    const levelNum = triageLevelToNumber(entry.triageEvent.aiSuggestedLevel);
    const threshold = SURGE_THRESHOLDS[levelNum];
    if (!threshold) return undefined;
    const waitMin = getWaitMinutes(entry.triageEvent.triageTime, currentTime);
    if (waitMin > threshold) {
      return levelNum === 2 ? "queue-row--surge-danger" : "queue-row--surge-warning";
    }
    return undefined;
  };

  const handleResolve = async (entry: QueueEntry) => {
    if (!window.confirm(`Are you sure you want to resolve ${formatPatientName(entry.patient)}?`)) {
      return;
    }
    setResolvingId(entry.triageEvent.id);
    try {
      await updateTriageStatus({ triageEventId: entry.triageEvent.id, status: "COMPLETED" });
      onRefresh();
    } catch (err) {
      console.error("Failed to resolve patient", err);
      alert("Failed to resolve patient.");
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <Paper className="queue-panel" elevation={2}>
      <Box className="queue-panel__header">
        <div>
          <Typography variant="h5" component="h2">
            Active Triage Queue
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Patients awaiting or in active review — sorted by urgency
          </Typography>
        </div>
        <Tooltip title="Refresh queue">
          <IconButton onClick={onRefresh} disabled={loading} aria-label="Refresh queue">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mx: 2, mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && entries.length === 0 ? (
        <Box className="queue-panel__loading">
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Patient</TableCell>
                <TableCell>Age Group</TableCell>
                <TableCell>AI Level</TableCell>
                <TableCell>Confidence</TableCell>
                <TableCell>Wait Time</TableCell>
                <TableCell>Uncertainty</TableCell>
                <TableCell>Flow Actions</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                      No patients in the active queue
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => {
                  const { patient, triageEvent, latestAuditLog } = entry;
                  const levelNum = triageLevelToNumber(triageEvent.aiSuggestedLevel);
                  const lowConfidence = triageEvent.aiConfidenceScore < 0.7;
                  const isOverridden = latestAuditLog !== null;
                  const isReassessment = triageEvent.status === "REASSESSMENT";

                  const criticalClass = levelNum <= 2 ? "queue-row--critical" : undefined;
                  const surgeClass = getSurgeRowClass(entry);
                  // Surge class takes precedence for visual urgency
                  const rowClass = surgeClass ?? criticalClass;

                  return (
                    <TableRow
                      key={triageEvent.id}
                      hover
                      className={rowClass}
                      onClick={() => setDetailsTarget(entry)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>
                        <Typography sx={{ fontWeight: 600 }}>
                          {formatPatientName(patient)}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            {patient.mrn}
                          </Typography>
                          {isReassessment && (
                            <Chip
                              label="RE-EVAL"
                              size="small"
                              color="info"
                              sx={{ fontWeight: "bold", fontSize: "0.6rem", height: "18px" }}
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={patient.ageGroup} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <Chip
                            label={`Level ${levelNum}`}
                            color={LEVEL_COLORS[triageEvent.aiSuggestedLevel]}
                            size="small"
                          />
                          {isOverridden && (
                            <Tooltip
                              title={`Overridden by ${latestAuditLog.clinicianRole}: ${latestAuditLog.overrideReason}`}
                            >
                              <Chip
                                icon={<GavelIcon />}
                                label="OVERRIDDEN"
                                size="small"
                                variant="outlined"
                                color="warning"
                                className="override-badge"
                              />
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box className="confidence-cell">
                          <Typography variant="body2">
                            {(triageEvent.aiConfidenceScore * 100).toFixed(0)}%
                          </Typography>
                          {lowConfidence && (
                            <Tooltip title="Low AI confidence — review recommended">
                              <WarningAmberIcon
                                className="confidence-warning"
                                fontSize="small"
                                color="warning"
                              />
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box className="wait-time-cell">
                          <AccessTimeIcon fontSize="small" color="action" />
                          <Typography variant="body2">
                            {formatWaitTime(triageEvent.triageTime, currentTime)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell className="uncertainty-cell">
                        {triageEvent.uncertaintyReason ? (
                          <Tooltip title={triageEvent.uncertaintyReason}>
                            <Typography variant="body2" noWrap>
                              {triageEvent.uncertaintyReason}
                            </Typography>
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            —
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Box className="actions-cell">
                          {triageEvent.suggestedActions.map((action) => (
                            <Chip
                              key={action}
                              label={action.replace(/_/g, " ")}
                              size="small"
                              variant="outlined"
                            />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={triageEvent.status} size="small" />
                      </TableCell>
                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                          <Tooltip title="View Patient Details">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => setDetailsTarget(entry)}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Override Triage Level">
                            <IconButton
                              size="small"
                              color="warning"
                              onClick={() => setOverrideTarget(entry)}
                            >
                              <GavelIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Resolve Patient">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => handleResolve(entry)}
                              disabled={resolvingId === triageEvent.id}
                            >
                              {resolvingId === triageEvent.id ? <CircularProgress size={20} /> : <CheckCircleOutlineIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <OverrideModal
        entry={overrideTarget}
        open={overrideTarget !== null}
        onClose={() => setOverrideTarget(null)}
        onSuccess={() => {
          setOverrideTarget(null);
          onRefresh();
        }}
      />

      <PatientDetailsModal
        entry={detailsTarget}
        open={detailsTarget !== null}
        onClose={() => setDetailsTarget(null)}
        onRefresh={onRefresh}
      />
    </Paper>
  );
}

