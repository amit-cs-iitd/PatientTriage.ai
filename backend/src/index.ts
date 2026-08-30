import "dotenv/config";
import cors from "cors";
import express from "express";
import triageRouter from "./routes/triage";

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/triage", triageRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(port, () => {
  console.log(`Triage API listening on http://localhost:${port}`);
});

export default app;
