const { Events, AuditLogEvent } = require('discord.js');

// ايدي الشخص المحمي من التايم اوت
const PROTECTED_USER_ID = '1489608833562316872';

module.exports = (client) => {
    client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
        // تحقق إذا الشخص هو المحمي
        if (newMember.id !== PROTECTED_USER_ID) return;

        // تحقق إذا تم إعطاؤه تايم اوت (communicationDisabledUntil تغيّرت)
        const wasTimedOut = !oldMember.communicationDisabledUntil;
        const isNowTimedOut = !!newMember.communicationDisabledUntil;

        if (wasTimedOut && isNowTimedOut) {
            try {
                // فك التايم اوت فوراً
                await newMember.timeout(null, 'الحماية التلقائية - لا يمكن تايم اوت هذا المستخدم');
                console.log(`[TimeoutProtector] تم فك التايم اوت عن ${newMember.user.tag} فوراً`);

                // اختياري: سجّل من أعطى التايم اوت
                try {
                    const auditLogs = await newMember.guild.fetchAuditLogs({
                        type: AuditLogEvent.MemberUpdate,
                        limit: 1,
                    });

                    const log = auditLogs.entries.first();
                    if (log && log.executor) {
                        console.log(`[TimeoutProtector] من أعطى التايم اوت: ${log.executor.tag}`);
                    }
                } catch (auditErr) {
                    console.warn('[TimeoutProtector] ما قدرت أجيب سجل التدقيق:', auditErr.message);
                }

            } catch (err) {
                console.error('[TimeoutProtector] خطأ في فك التايم اوت:', err.message);
            }
        }
    });

    console.log('[TimeoutProtector] ✅ نظام الحماية من التايم اوت شغّال');
};