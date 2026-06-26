import "dotenv/config";
import ffmpegPath from "ffmpeg-static";
if (ffmpegPath) process.env.FFMPEG_PATH = ffmpegPath;
import {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";
import {
  buildTicketPanel,
  handleTicketInteraction,
  deployTicketPanel,
} from "./tickets.js";
import {
  TICKET,
  CHANNELS,
  OWNER_ID,
  ticketConfigOk,
  missingTicketConfig,
  isBroadcastChannel,
} from "./config.js";
import { startTranscriptServer } from "./server.js";
import {
  buildRulesPanel,
  handleRulesButton,
  deployRulesPanel,
} from "./rules.js";
import { playAiWelcome } from "./voiceWelcome.js";

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error("Missing DISCORD_TOKEN. Add it in Railway Variables or in your local .env file.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Channel, Partials.Message],
});

const slashCommands = [
  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Post the ticket panel in this channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName("rulespanel")
    .setDescription("Post the rules panel in this channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
].map((c) => c.toJSON());

client.once("ready", async () => {
  console.log(`Bot online: ${client.user.tag}`);
  console.log("Broadcast channels:", CHANNELS.broadcast.length);
  console.log("Warn channel:", CHANNELS.warn || "not set");
  console.log("AI welcome VC:", CHANNELS.aiWelcomeVc || "not set");

  if (!ticketConfigOk()) {
    console.warn("Ticket system disabled — missing:", missingTicketConfig().join(", "));
  } else {
    console.log("Ticket system enabled.");
  }

  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
    console.log("Slash commands registered.");
  } catch (e) {
    console.error("Failed to register slash commands:", e);
  }

  if (TICKET.panelChannelId && ticketConfigOk()) {
    const ch = await client.channels.fetch(TICKET.panelChannelId).catch(() => null);
    if (ch?.isTextBased()) {
      const recent = await ch.messages.fetch({ limit: 10 }).catch(() => null);
      const hasPanel = recent?.some(
        (m) =>
          m.author.id === client.user.id &&
          m.components.some((row) => row.components.some((c) => c.customId === "ticket_open"))
      );
      if (!hasPanel) {
        await deployTicketPanel(ch);
        console.log("Ticket panel posted.");
      }
    }
  }

  if (CHANNELS.rulesPanel) {
    const ch = await client.channels.fetch(CHANNELS.rulesPanel).catch(() => null);
    if (ch?.isTextBased()) {
      const recent = await ch.messages.fetch({ limit: 10 }).catch(() => null);
      const hasRules = recent?.some(
        (m) =>
          m.author.id === client.user.id &&
          m.components.some((row) => row.components.some((c) => c.customId === "rules_discord"))
      );
      if (!hasRules) {
        await deployRulesPanel(ch);
        console.log("Rules panel posted.");
      }
    }
  }
});

async function dmUser(userId, payload) {
  try {
    const user = await client.users.fetch(userId);
    await user.send(payload);
    return true;
  } catch (err) {
    console.error(`Could not DM user ${userId}:`, err.message);
    return false;
  }
}

async function getChannelInvite(channel) {
  try {
    const invite = await channel.createInvite({
      maxAge: 86400,
      maxUses: 0,
      unique: false,
      reason: "DSA notification",
    });
    return `https://discord.gg/${invite.code}`;
  } catch {
    return null;
  }
}

function messagePreview(message, max = 1000) {
  const text = message.content?.trim() || "(no text — attachment/embed only)";
  return text.length > max ? text.slice(0, max - 3) + "..." : text;
}

/** Skip reply messages — only react to new messages / mentions */
function isReply(message) {
  return Boolean(message.reference?.messageId);
}

function getMentionedUsers(message) {
  return message.mentions.users.filter((u) => !u.bot && u.id !== message.author.id);
}

async function broadcastToAll(message, title = "Server announcement") {
  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle(title)
    .setDescription(messagePreview(message, 2000))
    .addFields(
      { name: "Channel", value: `<#${message.channel.id}>`, inline: true },
      { name: "From", value: message.author.tag, inline: true }
    )
    .setTimestamp(message.createdAt);

  const guild = message.guild;
  await guild.members.fetch().catch(() => null);
  const members = guild.members.cache.filter((m) => !m.user.bot);

  let sent = 0;
  let failed = 0;
  for (const [, member] of members) {
    const ok = await dmUser(member.id, { embeds: [embed] });
    if (ok) sent++;
    else failed++;
    await new Promise((r) => setTimeout(r, 350));
  }
  console.log(`Broadcast in ${message.channel.id}: sent ${sent}, failed ${failed}`);
}

async function handleWarn(message) {
  if (isReply(message)) return;
  const users = getMentionedUsers(message);
  if (!users.size) return;

  for (const [, user] of users) {
    await dmUser(user.id, {
      content:
        `# ⚠️ لقد تلقيت انذار\n\n` +
        `**From:** ${message.author.tag}\n` +
        `**Channel:** <#${message.channel.id}>\n\n` +
        `${messagePreview(message, 1500)}`,
    });
  }
}

async function handleDsaApplication(message) {
  const invite = await getChannelInvite(message.channel);
  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle("تقديم على ادارة DSA")
    .setDescription(
      `**Channel:** <#${message.channel.id}>\n` +
        `**From:** ${message.author.tag}\n\n` +
        `**Message:**\n${messagePreview(message)}`
    )
    .setTimestamp(message.createdAt);
  if (invite) embed.addFields({ name: "Room invite", value: invite });
  await dmUser(OWNER_ID, { embeds: [embed] });
}

async function handleOwnerNotify(message) {
  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle("New message in monitored channel")
    .setDescription(
      `**Channel:** <#${message.channel.id}>\n` +
        `**From:** ${message.author.tag}\n\n` +
        `**Message:**\n${messagePreview(message)}`
    )
    .setTimestamp(message.createdAt);
  await dmUser(OWNER_ID, { embeds: [embed] });
}

async function handlePromotion(message) {
  if (isReply(message)) return;
  const users = getMentionedUsers(message);
  if (!users.size) return;

  for (const [, user] of users) {
    await dmUser(user.id, {
      content: "# مبروك الترقية\n## تأكد منها في روم 🔷・promotions",
    });
  }
}

client.on("voiceStateUpdate", async (oldState, newState) => {
  if (newState.member?.user.bot) return;

  if (
    newState.channelId === CHANNELS.waitingSupportVc &&
    oldState.channelId !== CHANNELS.waitingSupportVc
  ) {
    await dmUser(newState.member.id, {
      content: "# مرحبا بك في انتظار الدعم الفني في سيرفر DSA",
    });
  }

  if (
    CHANNELS.aiWelcomeVc &&
    newState.channelId === CHANNELS.aiWelcomeVc &&
    oldState.channelId !== CHANNELS.aiWelcomeVc
  ) {
    const channel = newState.channel;
    if (channel?.isVoiceBased()) {
      playAiWelcome(newState.guild, channel, newState.member.id).catch((err) =>
        console.error("Voice welcome failed:", err.message)
      );
    }
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;
  const channelId = message.channel.id;

  try {
    if (isBroadcastChannel(channelId)) {
      await broadcastToAll(message);
      return;
    }

    if (channelId === CHANNELS.warn) {
      await handleWarn(message);
      return;
    }

    if (channelId === CHANNELS.dsaApplication) {
      await handleDsaApplication(message);
      return;
    }

    if (channelId === CHANNELS.updates) {
      await broadcastToAll(message, "Server update");
      return;
    }

    if (channelId === CHANNELS.ownerNotify) {
      await handleOwnerNotify(message);
      return;
    }

    if (channelId === CHANNELS.promotion) {
      await handlePromotion(message);
      return;
    }
  } catch (err) {
    console.error(`Error in channel ${channelId}:`, err);
  }
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "ticketpanel") {
        if (!interaction.channel?.isTextBased()) {
          return interaction.reply({ content: "Use in a text channel.", ephemeral: true });
        }
        await deployTicketPanel(interaction.channel);
        return interaction.reply({ content: "Ticket panel posted.", ephemeral: true });
      }
      if (interaction.commandName === "rulespanel") {
        if (!interaction.channel?.isTextBased()) {
          return interaction.reply({ content: "Use in a text channel.", ephemeral: true });
        }
        await deployRulesPanel(interaction.channel);
        return interaction.reply({ content: "Rules panel posted.", ephemeral: true });
      }
    }

    if (interaction.isButton()) {
      const id = interaction.customId;
      if (id === "rules_discord" || id === "rules_admin" || id === "rules_staff_apply") {
        return handleRulesButton(interaction);
      }
      if (
        id.startsWith("ticket_claim_") ||
        id.startsWith("ticket_options_")
      ) {
        return handleTicketInteraction(interaction);
      }
    }

    if (interaction.isStringSelectMenu()) {
      const id = interaction.customId;
      if (
        id === "ticket_open" ||
        id.startsWith("ticket_action_")
      ) {
        return handleTicketInteraction(interaction);
      }
    }
  } catch (err) {
    console.error("Interaction error:", err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "An error occurred.", ephemeral: true }).catch(() => {});
    }
  }
});

client.login(TOKEN);
startTranscriptServer();
require('./timeoutProtector')(client);