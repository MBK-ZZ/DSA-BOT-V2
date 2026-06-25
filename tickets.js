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

const DATA_FILE = "tickets-data.json";

export const WAITING_SUPPORT_VC = "1509551318358950052";

export const TICKET_TYPES = {
  tech: { emoji: "🖥️", label: "Technical Support | الدعم الفني" },
  high: { emoji: "🛡️", label: "High Management | الإدارة العليا" },
  inquiry: { emoji: "❓", label: "Inquiry | استفسار" },
  ban: { emoji: "🔨", label: "Ban or Warning Review Request | طلب مراجعة باند أو تحذير" },
  report: { emoji: "🚨", label: "Staff Report | إبلاغ عن إداري" },
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
  const raw = process.env.STAFF_ROLE_IDS || "";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function staffMention(guild) {
  const ids = getStaffRoleIds();
  if (ids.length) return ids.map((id) => `<@&${id}>`).join(" ");
  return guild.roles.cache
    .filter((r) => r.permissions.has(PermissionFlagsBits.ManageGuild) && r.name !== "@everyone")
    .map((r) => `<@&${r.id}>`)
    .slice(0, 6)
    .join(" ") || "@everyone";
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
          .setLabel(t.label)
          .setValue(value)
          .setEmoji(t.emoji)
      )
    );

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(menu)],
  };
}

function buildTicketEmbed(guild, ticket, typeKey, ownerUser) {
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

async function fetchTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const lines = [...messages.values()]
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .map((m) => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.content || "(attachment/embed)"}`);
  return lines.join("\n").slice(0, 1900);
}

export async function createTicket(interaction) {
  const typeKey = interaction.values[0];
  const type = TICKET_TYPES[typeKey];
  if (!type) {
    return interaction.reply({ content: "Invalid ticket type.", ephemeral: true });
  }

  const categoryId = process.env.TICKET_CATEGORY_ID;
  if (!categoryId) {
    return interaction.reply({
      content: "Ticket category is not configured. Set TICKET_CATEGORY_ID in .env",
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

  const overwrites = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
    {
      id: interaction.client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
  ];

  for (const roleId of getStaffRoleIds()) {
    overwrites.push({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
  }

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

  const embed = buildTicketEmbed(guild, ticket, typeKey, interaction.user);
  const staffPing = staffMention(guild);

  await channel.send({
    content: `${interaction.user} ${staffPing}`,
    embeds: [embed],
    components: [buildTicketButtons(channel.id)],
  });

  await interaction.editReply({
    content: `Ticket created: ${channel}`,
  });
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
        await interaction.reply({ content: "Closing ticket in 3 seconds...", ephemeral: true });
        ticket.open = false;
        delete data.tickets[channelId];
        saveData(data);

        const logsId = process.env.TICKET_LOGS_CHANNEL_ID;
        if (logsId) {
          const logs = await interaction.guild.channels.fetch(logsId).catch(() => null);
          if (logs) {
            const transcript = await fetchTranscript(interaction.channel).catch(() => "Could not fetch transcript.");
            await logs.send({
              embeds: [
                new EmbedBuilder()
                  .setTitle(`Ticket #${ticket.number} closed`)
                  .setDescription(`Closed by ${interaction.user.tag}\n\n\`\`\`\n${transcript}\n\`\`\``)
                  .setColor(0xe74c3c),
              ],
            });
          }
        }

        setTimeout(() => interaction.channel.delete("Ticket closed").catch(() => {}), 3000);
        return;
      }

      if (action === "copy") {
        const transcript = await fetchTranscript(interaction.channel).catch(() => "Could not fetch transcript.");
        try {
          await interaction.user.send({
            embeds: [
              new EmbedBuilder()
                .setTitle(`Ticket #${ticket.number} copy`)
                .setDescription(`\`\`\`\n${transcript}\n\`\`\``)
                .setColor(0x3498db),
            ],
          });
          return interaction.reply({ content: "Ticket copy sent to your DMs.", ephemeral: true });
        } catch {
          return interaction.reply({ content: "Could not DM you. Open your DMs.", ephemeral: true });
        }
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

    const embed = buildTicketEmbed(interaction.guild, ticket, ticket.type, interaction.user);
    const msg = interaction.message;
    await msg.edit({ embeds: [embed], components: msg.components });

    await interaction.reply({
      content: `Ticket claimed by ${interaction.user}.`,
      ephemeral: false,
    });
    return;
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
