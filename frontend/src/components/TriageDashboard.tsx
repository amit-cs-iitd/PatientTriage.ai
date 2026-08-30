import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Container,
  Toolbar,
  Typography,
} from "@mui/material";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import BoltIcon from "@mui/icons-material/Bolt";
import IntakeForm from "./IntakeForm";
import QueueTable from "./QueueTable";
import { fetchQueue } from "../services/api";
import type { QueueEntry } from "../types/triage";
import "./TriageDashboard.css";

export default function TriageDashboard() {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [surgeMode, setSurgeMode] = useState(false);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchQueue();
      setEntries(data.queue);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(loadQueue, 0);
    const interval = setInterval(loadQueue, 30_000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [loadQueue]);

  return (
    <Box className="dashboard">
      <AppBar position="static" elevation={1} className="dashboard__appbar">
        <Toolbar>
          <LocalHospitalIcon sx={{ mr: 1.5 }} />
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
            ED Triage Co-Pilot
          </Typography>
          <Button
            variant={surgeMode ? "contained" : "outlined"}
            color={surgeMode ? "error" : "inherit"}
            size="small"
            startIcon={<BoltIcon />}
            onClick={() => setSurgeMode((prev) => !prev)}
            className="dashboard__surge-btn"
          >
            {surgeMode ? "Surge Active (3× Volume)" : "Simulate Surge (3× Volume)"}
          </Button>
          <Typography variant="body2" sx={{ opacity: 0.85, ml: 2 }}>
            Safety Agent + Flow Agent
          </Typography>
        </Toolbar>
      </AppBar>

      {surgeMode && (
        <Alert
          severity="error"
          variant="filled"
          className="dashboard__surge-banner"
          icon={<BoltIcon />}
        >
          <strong>SURGE MODE ACTIVE</strong> — Simulating 3× patient volume.
          Patients exceeding safe wait-time thresholds will be highlighted.
          Level 2 &gt; 10 min · Level 3 &gt; 30 min.
        </Alert>
      )}

      <Container maxWidth={false} className="dashboard__container">
        <Box className="dashboard__split">
          <IntakeForm onSuccess={loadQueue} />
          <QueueTable
            entries={entries}
            loading={loading}
            error={error}
            onRefresh={loadQueue}
            surgeMode={surgeMode}
          />
        </Box>
      </Container>
    </Box>
  );
}
