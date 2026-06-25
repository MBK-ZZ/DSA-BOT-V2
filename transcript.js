import * as fs from "fs";
import * as path from "path";

const TRANSCRIPTS_DIR = "transcripts";

export function ensureTranscriptsDir() {
  if (!fs.existsSync(TRANSCRIPTS_DIR)) {
    fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
  }
}

export function getTranscriptBaseUrl() {
  if (process.env.TRANSCRIPT_BASE_URL) {
    return process.env.TRANSCRIPT_BASE_URL.replace(/\/$/, "");
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  const port = process.env.PORT || 3000;
  return `http://localhost:${port}`;
}

export function getTranscriptUrl(transcriptId) {
  return `${getTranscriptBaseUrl()}/transcript/${transcriptId}.html`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTime(ts) {
  return new Date(ts).toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export async function fetchAllMessages(channel) {
  const all = [];
  let before;

  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, ...(before && { before }) });
    if (!batch.size) break;
    all.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }

  return all.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

export async function saveTranscriptHtml({ ticket, guild, messages, typeLabel }) {
  ensureTranscriptsDir();
  const transcriptId = `ticket-${ticket.number}-${ticket.channelId.slice(-6)}`;
  const filePath = path.join(TRANSCRIPTS_DIR, `${transcriptId}.html`);

  const messageRows = messages
    .map((m) => {
      const avatar = m.author.displayAvatarURL({ extension: "png", size: 64 });
      const content = m.content
        ? escapeHtml(m.content).replace(/\n/g, "<br>")
        : "<em>(attachment / embed)</em>";
      const attachments = [...m.attachments.values()]
        .map((a) => `<a href="${escapeHtml(a.url)}" target="_blank">${escapeHtml(a.name || "file")}</a>`)
        .join(" ");

      return `
        <div class="message">
          <img class="avatar" src="${avatar}" alt="avatar" />
          <div class="bubble">
            <div class="author">${escapeHtml(m.author.tag)} <span class="time">${formatTime(m.createdTimestamp)}</span></div>
            <div class="content">${content}</div>
            ${attachments ? `<div class="attachments">${attachments}</div>` : ""}
          </div>
        </div>`;
    })
    .join("\n");

  const claimed = ticket.claimedBy ? `<@${ticket.claimedBy}>` : "No one";
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ticket #${ticket.number} | ${escapeHtml(guild.name)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Tahoma, sans-serif;
      background: #313338;
      color: #dbdee1;
    }
    .header {
      background: #2b2d31;
      padding: 24px;
      border-bottom: 1px solid #1e1f22;
    }
    .header h1 { margin: 0 0 8px; font-size: 24px; }
    .meta { color: #b5bac1; font-size: 14px; line-height: 1.8; }
    .messages { max-width: 960px; margin: 0 auto; padding: 24px 16px 48px; }
    .message { display: flex; gap: 12px; margin-bottom: 18px; }
    .avatar { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; }
    .author { font-weight: 600; margin-bottom: 4px; }
    .time { color: #949ba4; font-weight: 400; font-size: 12px; margin-left: 8px; }
    .content { line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
    .attachments { margin-top: 8px; font-size: 14px; }
    .attachments a { color: #00a8fc; }
    .footer {
      text-align: center;
      color: #949ba4;
      padding: 16px;
      font-size: 13px;
      border-top: 1px solid #1e1f22;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎫 Ticket #${ticket.number}</h1>
    <div class="meta">
      <div><strong>Server:</strong> ${escapeHtml(guild.name)}</div>
      <div><strong>Section:</strong> ${escapeHtml(typeLabel)}</div>
      <div><strong>Owner:</strong> &lt;@${ticket.ownerId}&gt;</div>
      <div><strong>Claimed By:</strong> ${claimed}</div>
      <div><strong>Open Time:</strong> ${formatTime(ticket.createdAt)}</div>
    </div>
  </div>
  <div class="messages">
    ${messageRows || "<p>No messages in this ticket.</p>"}
  </div>
  <div class="footer">Exported ${messages.length} message(s)</div>
</body>
</html>`;

  fs.writeFileSync(filePath, html, "utf8");
  return { transcriptId, url: getTranscriptUrl(transcriptId) };
}
