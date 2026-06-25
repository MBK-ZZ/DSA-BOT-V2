import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { ensureTranscriptsDir } from "./transcript.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function startTranscriptServer() {
  ensureTranscriptsDir();
  const app = express();
  const transcriptsPath = path.join(__dirname, "transcripts");

  app.get("/", (_req, res) => {
    res.send("DSA Bot is online. Transcripts: /transcript/ticket-XX.html");
  });

  app.use("/transcript", express.static(transcriptsPath));

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Transcript server running on port ${port}`);
  });
}
