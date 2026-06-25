import "dotenv/config";
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
  WAITING_SUPPORT_VC,
  buildTicketPanel,
  handleTicketInteraction,
  deployTicketPanel,
} from "./tickets.js";

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error("Missing DISCORD_TOKEN in .env");
  process.exit(1);
}

const OWNER_ID = "1157384165130506363";

const CHANNELS = {
  MENTION_NOTIFY: "1509354645166882936",
  DSA_APPLICATION: "1519393853033943173",
  UPDATES: "1496946903588540599",
  OWNER_NOTIFY: "1512060830815092897",
  PROMOTION: "1515421927060148535",
};

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
].map((c) => c.toJSON());

client.once("ready", async () => {
  console.log(`Bot online: ${client.user.tag}`);
  console.log("Listening for messages, voice joins, and tickets...");

  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
    console.log("Slash commands registered.");
  } catch (e) {
    console.error("Failed to register slash commands:", e);
  }

  const panelChannelId = process.env.TICKET_PANEL_CHANNEL_ID;
  if (panelChannelId) {
    const ch = await client.channels.fetch(panelChannelId).catch(() => null);
    if (ch?.isTextBased()) {
      const recent = await ch.messages.fetch({ limit: 10 }).catch(() => null);
      const hasPanel = recent?.some((m) =>
        m.author.id === client.user.id &&
        m.components.some((row) =>
          row.components.some((c) => c.customId === "ticket_open")
        )
      );
      if (!hasPanel) {
        await deployTicketPanel(ch);
        console.log(`Ticket panel posted in ${panelChannelId}`);
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
      reason: "DSA application notification",
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

async function handleMentionNotify(message) {
  const users = message.mentions.users.filter((u) => !u.bot && u.id !== message.author.id);
  if (!users.size) return;

  for (const [, user] of users) {
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("You were mentioned")
      .setDescription(
        `**Channel:** <#${message.channel.id}>\n` +
          `**From:** ${message.author.tag} (\`${message.author.id}\`)\n\n` +
          `**Message:**\n${messagePreview(message)}`
      )
      .setTimestamp(message.createdAt);

    if (message.attachments.size) {
      embed.addFields({ name: "Attachments", value: `${message.attachments.size} file(s)` });
    }

    await dmUser(user.id, { embeds: [embed] });
  }
}

async function handleDsaApplication(message) {
  const invite = await getChannelInvite(message.channel);
  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle("تقديم على ادارة DSA")
    .setDescription(
      `**Channel:** <#${message.channel.id}>\n` +
        `**From:** ${message.author.tag} (\`${message.author.id}\`)\n\n` +
        `**Message:**\n${messagePreview(message)}`
    )
    .setTimestamp(message.createdAt);

  if (invite) embed.addFields({ name: "Room invite", value: invite });

  await dmUser(OWNER_ID, { embeds: [embed] });
}

async function handleUpdatesBroadcast(message) {
  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("Server update")
    .setDescription(messagePreview(message, 2000))
    .addFields(
      { name: "Channel", value: `<#${message.channel.id}>`, inline: true },
      { name: "From", value: message.author.tag, inline: true }
    )
    .setTimestamp(message.createdAt);

  const guild = message.guild;
  if (!guild) return;

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

  console.log(`Updates broadcast: sent ${sent}, failed ${failed}`);
}

async function handleOwnerNotify(message) {
  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle("New message in monitored channel")
    .setDescription(
      `**Channel:** <#${message.channel.id}>\n` +
        `**From:** ${message.author.tag} (\`${message.author.id}\`)\n\n` +
        `**Message:**\n${messagePreview(message)}`
    )
    .setTimestamp(message.createdAt);

  await dmUser(OWNER_ID, { embeds: [embed] });
}

async function handlePromotion(message) {
  const users = message.mentions.users.filter((u) => !u.bot);
  if (!users.size) return;

  for (const [, user] of users) {
    await dmUser(user.id, {
      content: "# مبروك الترقية\n## تأكد منها في روم 🔷・promotions",
    });
  }
}

client.on("voiceStateUpdate", async (oldState, newState) => {
  if (newState.channelId !== WAITING_SUPPORT_VC) return;
  if (oldState.channelId === WAITING_SUPPORT_VC) return;
  if (newState.member?.user.bot) return;

  await dmUser(newState.member.id, {
    content: "مرحبا بك في انتظار الدعم الفني في سيرفر DSA",
  });
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const channelId = message.channel.id;

  try {
    switch (channelId) {
      case CHANNELS.MENTION_NOTIFY:
        await handleMentionNotify(message);
        break;
      case CHANNELS.DSA_APPLICATION:
        await handleDsaApplication(message);
        break;
      case CHANNELS.UPDATES:
        await handleUpdatesBroadcast(message);
        break;
      case CHANNELS.OWNER_NOTIFY:
        await handleOwnerNotify(message);
        break;
      case CHANNELS.PROMOTION:
        await handlePromotion(message);
        break;
    }
  } catch (err) {
    console.error(`Error handling message in ${channelId}:`, err);
  }
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === "ticketpanel") {
      if (!interaction.channel?.isTextBased()) {
        return interaction.reply({ content: "Use this in a text channel.", ephemeral: true });
      }
      await deployTicketPanel(interaction.channel);
      return interaction.reply({ content: "Ticket panel posted.", ephemeral: true });
    }

    if (
      interaction.isStringSelectMenu() ||
      interaction.isButton()
    ) {
      const id =
        interaction.customId ||
        interaction.component?.customId ||
        "";
      if (
        id === "ticket_open" ||
        id.startsWith("ticket_claim_") ||
        id.startsWith("ticket_options_") ||
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
