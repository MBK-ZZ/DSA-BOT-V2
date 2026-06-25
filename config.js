// Ticket settings — edit here OR set in Railway / .env Variables
export const TICKET = {
  categoryId: process.env.TICKET_CATEGORY_ID || "",
  panelChannelId: process.env.TICKET_PANEL_CHANNEL_ID || "",
  logsChannelId: process.env.TICKET_LOGS_CHANNEL_ID || "",
  staffRoleIds: (process.env.STAFF_ROLE_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};

export function ticketConfigOk() {
  return Boolean(TICKET.categoryId && TICKET.panelChannelId);
}

export function missingTicketConfig() {
  const missing = [];
  if (!TICKET.categoryId) missing.push("TICKET_CATEGORY_ID");
  if (!TICKET.panelChannelId) missing.push("TICKET_PANEL_CHANNEL_ID");
  return missing;
}
