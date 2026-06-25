function parseIds(raw) {
  return (raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Ticket settings
export const TICKET = {
  categoryId: process.env.TICKET_CATEGORY_ID || "",
  panelChannelId: process.env.TICKET_PANEL_CHANNEL_ID || "",
  logsChannelId: process.env.TICKET_LOGS_CHANNEL_ID || "",
  staffRoleIds: parseIds(process.env.STAFF_ROLE_IDS),
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

// Channel & voice settings (set in Railway Variables)
export const CHANNELS = {
  /** Broadcast message content to all members via DM */
  broadcast: parseIds(
    process.env.BROADCAST_CHANNEL_IDS ||
      "1509352154916196523,1518955132094775428,1509353513287946270,1496900803087175720,1509354645166882936"
  ),
  /** Mention only (not reply) → DM warning to mentioned user */
  warn: process.env.WARN_CHANNEL_ID || "1505515092819710043",
  dsaApplication: process.env.DSA_APPLICATION_CHANNEL_ID || "1519393853033943173",
  updates: process.env.UPDATES_CHANNEL_ID || "1496946903588540599",
  ownerNotify: process.env.OWNER_NOTIFY_CHANNEL_ID || "1512060830815092897",
  promotion: process.env.PROMOTION_CHANNEL_ID || "1515421927060148535",
  waitingSupportVc: process.env.WAITING_SUPPORT_VC_ID || "1509551318358950052",
  /** Voice channel: bot joins and speaks AI welcome */
  aiWelcomeVc: process.env.AI_WELCOME_VC_ID || "",
  rulesPanel: process.env.RULES_PANEL_CHANNEL_ID || "",
  rulesBannerUrl: process.env.RULES_BANNER_URL || "",
};

export const OWNER_ID = process.env.OWNER_ID || "1157384165130506363";

export function isBroadcastChannel(id) {
  return CHANNELS.broadcast.includes(id);
}

export function isMentionOnlyChannel(id) {
  return id === CHANNELS.warn || id === CHANNELS.promotion;
}
