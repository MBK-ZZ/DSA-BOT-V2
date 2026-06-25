import * as fs from "fs";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { TICKET } from "./config.js";
import {
  fetchAllMessages,
  saveTranscriptHtml,
} from "./transcript.js";

const DATA_FILE = "tickets-data.json";

export const WAITING_SUPPORT_VC = "1509551318358950052";

export const TICKET_TYPES = {
  tech: { emoji: "🖥️", label: "Technical Support | الدعم الفني" },
  high: { emoji: "🛡️", label: "High Management | الإدارة العليا" },
  inquiry: { emoji: "❓", label: "Inquiry | استفسار" },
  ban: { emoji: "🔨", label: "Ban or Warning Review Request | طلب مراجعة باند أو تحذير" },
  report: { emoji: "🚨", label: "Staff Report | إبلاغ عن إداري" },
  demotion: { emoji: "📉", label: "Demotion Review | مراجعة إنزال رتبة" },
  partnership: { emoji: "🤝", label: "Partnership | شراكة" },
  staffapp: { emoji: "📋", label: "Staff Application | تقديم للإدارة" },
};

const RULES_TEXT = `**بعض الأساسيات لتجنب عدم إقفال التكت :**

1. في حال فتحت تكت ولم تطرح موضوعك خلال 10 دقائق سيتم إغلاق التكت.
2. في حال رد عليك أحد الإداريين ولم تقم بالرد خلال 10 ساعات سيتم إغلاق التكت.
3. في حال فتحت تكت مباشرة اطرح موضوعك بالكامل وسيتم الرد عليك.
4. في حال قمت بفتح تكت غير مخصص لمشكلتك سيتم إغلاقه.
5. في حال قمت بفتح أكثر من تكت لنفس المشكلة سيتم حذف التذاكر الإضافية.
6. في حال قمت بإزعاج الإدارة أو تكرار المنشن قد يتم إغلاق التكت.
7. في حال كانت لديك أدلة أو صور تدعم طلبك يرجى إرفاقها داخل التكت.
8. يمنع السب أو الاستفزاز أو عدم احترام أعضاء الإدارة.

والانتظار حتى يتم الرد. في حال مخالفة أي من القوانين المذكورة أعلاه يحق للإدارة إغلاق التكت بشكل مباشر.`;

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    return { counter: 0, tickets: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return { counter: 0, tickets: {} };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

function getStaffRoleIds() {
  return TICKET.staffRoleIds;
}

function isStaffRole(role) {
  if (getStaffRoleIds().includes(role.id)) return true;
  return (
    role.permissions.has(PermissionFlagsBits.ManageMessages) ||
    role.permissions.has(PermissionFlagsBits.Administrator)
  );
}

function staffMention(guild) {
  const ids = getStaffRoleIds();
  if (ids.length) return ids.map((id) => `<@&${id}>`).join(" ");
  return (
    guild.roles.cache
      .filter((r) => isStaffRole(r) && r.id !== guild.id)
      .map((r) => `<@&${r.id}>`)
      .slice(0, 10)
      .join(" ") || "@everyone"
  );
}

function isStaff(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const ids = getStaffRoleIds();
  return ids.some((id) => member.roles.cache.has(id));
}

function formatDate(date) {
  return date.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function buildViewTicketButton(url) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("View Ticket")
      .setStyle(ButtonStyle.Link)
      .setURL(url)
  );
}

function buildClosedLogEmbed(guild, ticket, closedByUser, closeTime) {
  const claimed = ticket.claimedBy ? `<@${ticket.claimedBy}>` : "No one";
  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor({
      name: guild.name,
      iconURL: guild.iconURL({ size: 64 }) ?? undefined,
    })
    .setTitle("Ticket Closed")
    .addFields(
      { name: "Opened By", value: `<@${ticket.ownerId}>`, inline: true },
      { name: "Claimed By", value: claimed, inline: true },
      { name: "Closed By", value: `<@${closedByUser.id}>`, inline: true },
      { name: "Open Time", value: formatDate(new Date(ticket.createdAt)), inline: false },
      { name: "Close Time", value: formatDate(closeTime), inline: false }
    );
}

function buildCopyEmbed(ticket) {
  const claimed = ticket.claimedBy ? `<@${ticket.claimedBy}>` : "No one";
  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle("Ticket Copy")
    .addFields(
      { name: "Ticket owner", value: `<@${ticket.ownerId}>`, inline: true },
      { name: "Claimed By", value: claimed, inline: true },
      { name: "Open Time", value: formatDate(new Date(ticket.createdAt)), inline: false }
    );
}

async function buildTicketPermissions(guild, ownerId, botId) {
  await guild.roles.fetch();
  const overwrites = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: ownerId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
    {
      id: botId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
  ];

  for (const role of guild.roles.cache.values()) {
    if (role.id === guild.id) continue;
    const allow = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.ReadMessageHistory,
    ];
    if (isStaffRole(role)) {
      allow.push(PermissionFlagsBits.SendMessages);
    }
    overwrites.push({ id: role.id, allow });
  }

  return overwrites;
}

async function createTranscript(channel, ticket, guild) {
  const messages = await fetchAllMessages(channel);
  const type = TICKET_TYPES[ticket.type];
  return saveTranscriptHtml({
    ticket,
    guild,
    messages,
    typeLabel: type ? `${type.emoji} ${type.label}` : ticket.type,
  });
}

export function buildTicketPanel() {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Ticket System | نظام التذاكر")
    .setDescription(RULES_TEXT);

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket_open")
    .setPlaceholder("Select a ticket option")
    .addOptions(
      Object.entries(TICKET_TYPES).map(([value, t]) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(t.label.slice(0, 100))
          .setValue(value)
          .setEmoji(t.emoji)
      )
    );

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(menu)],
  };
}

function buildTicketEmbed(guild, ticket, typeKey) {
  const type = TICKET_TYPES[typeKey];
  const claimed = ticket.claimedBy
    ? `<@${ticket.claimedBy}>`
    : "Not claimed yet | لم يتم الاستلام";

  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .addFields(
      { name: "👤 | Ticket Owner", value: `<@${ticket.ownerId}>`, inline: true },
      { name: "🛡️ | Ticket Admins", value: staffMention(guild), inline: true },
      { name: "📅 | Ticket Date", value: formatDate(new Date(ticket.createdAt)), inline: false },
      { name: "🔢 | Ticket Number", value: `${ticket.number}`, inline: true },
      { name: "❓ | Ticket Section", value: `${type.emoji} | ${type.label}`, inline: true },
      { name: "💼 | Claimed By", value: claimed, inline: false }
    );
}

function buildTicketButtons(channelId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_options_${channelId}`)
      .setLabel("Ticket Options")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🗄️"),
    new ButtonBuilder()
      .setCustomId(`ticket_claim_${channelId}`)
      .setLabel("Claim")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("💼")
  );
}

export async function createTicket(interaction) {
  const typeKey = interaction.values[0];
  const type = TICKET_TYPES[typeKey];
  if (!type) {
    return interaction.reply({ content: "Invalid ticket type.", ephemeral: true });
  }

  const categoryId = TICKET.categoryId;
  if (!categoryId) {
    return interaction.reply({
      content:
        "Ticket system is not configured. Set **TICKET_CATEGORY_ID** in Railway Variables or .env",
      ephemeral: true,
    });
  }

  const guild = interaction.guild;
  const data = loadData();
  const existing = Object.values(data.tickets).find(
    (t) => t.ownerId === interaction.user.id && t.open
  );
  if (existing) {
    return interaction.reply({
      content: `You already have an open ticket: <#${existing.channelId}>`,
      ephemeral: true,
    });
  }

  data.counter += 1;
  const number = data.counter;

  await interaction.deferReply({ ephemeral: true });

  const overwrites = await buildTicketPermissions(
    guild,
    interaction.user.id,
    interaction.client.user.id
  );

  const channel = await guild.channels.create({
    name: `🎫・${number}`,
    type: ChannelType.GuildText,
    parent: categoryId,
    permissionOverwrites: overwrites,
    reason: `Ticket #${number} opened by ${interaction.user.tag}`,
  });

  const ticket = {
    number,
    channelId: channel.id,
    ownerId: interaction.user.id,
    type: typeKey,
    claimedBy: null,
    open: true,
    createdAt: Date.now(),
  };
  data.tickets[channel.id] = ticket;
  saveData(data);

  const embed = buildTicketEmbed(guild, ticket, typeKey);
  const staffPing = staffMention(guild);

  await channel.send({
    content: `${interaction.user} ${staffPing}`,
    embeds: [embed],
    components: [buildTicketButtons(channel.id)],
  });

  await interaction.editReply({ content: `Ticket created: ${channel}` });

  if (interaction.message?.editable) {
    await interaction.message.edit(buildTicketPanel()).catch(() => {});
  }
}

async function sendTicketCopy(interaction, ticket) {
  const { url } = await createTranscript(interaction.channel, ticket, interaction.guild);
  const embed = buildCopyEmbed(ticket);

  try {
    await interaction.user.send({
      embeds: [embed],
      components: [buildViewTicketButton(url)],
    });
    return interaction.reply({ content: "Ticket copy sent to your DMs.", ephemeral: true });
  } catch {
    return interaction.reply({
      content: "Could not DM you. Open your DMs.",
      ephemeral: true,
    });
  }
}

async function closeTicket(interaction, ticket) {
  const closeTime = new Date();
  const { url } = await createTranscript(interaction.channel, ticket, interaction.guild);

  const data = loadData();
  ticket.open = false;
  delete data.tickets[interaction.channel.id];
  saveData(data);

  const logsId = TICKET.logsChannelId;
  if (logsId) {
    const logs = await interaction.guild.channels.fetch(logsId).catch(() => null);
    if (logs?.isTextBased()) {
      const logEmbed = buildClosedLogEmbed(
        interaction.guild,
        ticket,
        interaction.user,
        closeTime
      );
      await logs.send({
        embeds: [logEmbed],
        components: [buildViewTicketButton(url)],
      });
    }
  }

  await interaction.reply({ content: "Closing ticket in 3 seconds...", ephemeral: true });
  setTimeout(() => interaction.channel.delete("Ticket closed").catch(() => {}), 3000);
}

export async function handleTicketInteraction(interaction) {
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === "ticket_open") {
      return createTicket(interaction);
    }
    if (interaction.customId.startsWith("ticket_action_")) {
      const channelId = interaction.customId.replace("ticket_action_", "");
      const action = interaction.values[0];
      const data = loadData();
      const ticket = data.tickets[channelId];
      if (!ticket) {
        return interaction.reply({ content: "Ticket not found.", ephemeral: true });
      }

      if (action === "close") {
        if (!isStaff(interaction.member) && interaction.user.id !== ticket.ownerId) {
          return interaction.reply({ content: "You cannot close this ticket.", ephemeral: true });
        }
        return closeTicket(interaction, ticket);
      }

      if (action === "copy") {
        return sendTicketCopy(interaction, ticket);
      }
    }
    return;
  }

  if (!interaction.isButton()) return;

  const channelId = interaction.channel.id;

  if (interaction.customId === `ticket_claim_${channelId}`) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: "Only staff can claim tickets.", ephemeral: true });
    }

    const data = loadData();
    const ticket = data.tickets[channelId];
    if (!ticket) {
      return interaction.reply({ content: "Ticket data not found.", ephemeral: true });
    }
    if (ticket.claimedBy) {
      return interaction.reply({
        content: `Already claimed by <@${ticket.claimedBy}>`,
        ephemeral: true,
      });
    }

    ticket.claimedBy = interaction.user.id;
    saveData(data);

    const embed = buildTicketEmbed(interaction.guild, ticket, ticket.type);
    await interaction.message.edit({ embeds: [embed], components: interaction.message.components });

    return interaction.reply({
      content: `Ticket claimed by ${interaction.user}.`,
      ephemeral: false,
    });
  }

  if (interaction.customId === `ticket_options_${channelId}`) {
    const data = loadData();
    const ticket = data.tickets[channelId];
    if (!ticket) {
      return interaction.reply({ content: "Ticket not found.", ephemeral: true });
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`ticket_action_${channelId}`)
      .setPlaceholder("Choose a Ticket Action")
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Close Ticket")
          .setDescription("Close the ticket")
          .setValue("close")
          .setEmoji("🔒"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Request Ticket Copy")
          .setDescription("Request a copy of the ticket")
          .setValue("copy")
          .setEmoji("📄")
      );

    return interaction.reply({
      content: "Choose an action:",
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true,
    });
  }
}

export async function deployTicketPanel(channel) {
  await channel.send(buildTicketPanel());
}
