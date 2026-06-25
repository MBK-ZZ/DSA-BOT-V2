import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { CHANNELS } from "./config.js";

const DISCORD_RULES = `**قوانين الديسكورد**

• احترم شروط خدمة Discord وإرشادات المجتمع.
• لا تنشر محتوى مخالف أو مسيء أو غير لائق.
• لا تشارك معلومات شخصية لأي شخص.
• لا تستخدم السيرفر لأغراض غير قانونية.
• احترم خصوصية الآخرين ولا تزعجهم.`;

const ADMIN_RULES = `**قوانين الاداره**

1. ممنوع تبنيد أي شخص من دون سبب
2. ممنوع تعطي تايم اوت لأي شخص من دون سبب
3. ممنوع تسوي رومات ما منها فايده
4. ممنوع تغير رتب أي شخص من دون علم مسؤول السيرفر
5. ممنوع تطرد أي شخص من السيرفر من دون سبب
6. ممنوع تتسلط على أي شخص

إذا خالفت القوانين ممكن تنزل رتبه او رتبتين او ممكن تنطرد من السيرفر`;

const STAFF_APPLY_RULES = `**📋 شروط التقديم للإدارة**

• احترام جميع الأعضاء والإدارة.
• العمر 14 سنة أو أكثر.
• التواجد والتفاعل المستمر.
• تحمل المسؤولية.
• الالتزام بقوانين السيرفر.
• عدم إساءة استخدام الصلاحيات.
• التعاون مع فريق الإدارة.
• يمنع طلب الرتب أو الإزعاج.
• أي استغلال يؤدي إلى سحب الرتبة مباشرة.`;

export function buildRulesPanel() {
  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle("القوانين")
    .setDescription("الرجاء عدم مخالفة القوانين");

  if (CHANNELS.rulesBannerUrl) {
    embed.setImage(CHANNELS.rulesBannerUrl);
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("rules_discord")
      .setLabel("قوانين الديسكورد")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("rules_admin")
      .setLabel("قوانين الاداره")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("rules_staff_apply")
      .setLabel("شروط تقديم الاداره")
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

export async function handleRulesButton(interaction) {
  const map = {
    rules_discord: { title: "قوانين الديسكورد", body: DISCORD_RULES },
    rules_admin: { title: "قوانين الاداره", body: ADMIN_RULES },
    rules_staff_apply: { title: "شروط تقديم الاداره", body: STAFF_APPLY_RULES },
  };

  const data = map[interaction.customId];
  if (!data) return;

  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle(data.title)
    .setDescription(data.body);

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

export async function deployRulesPanel(channel) {
  await channel.send(buildRulesPanel());
}
