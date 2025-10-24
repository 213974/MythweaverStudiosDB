// src/events/guildMemberAdd.js
const { Events, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../utils/database');
const economyManager = require('../managers/economyManager');
const { createWelcomeBanner } = require('../../services/imageGenerator/welcomeBanner');

const invites = new Map();

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member, client) {
        const { guild, user } = member;

        // --- 1. Send Welcome Banner ---
        const welcomeChannelId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'welcome_channel_id'").get(guild.id)?.value;
        if (welcomeChannelId) {
            const channel = await guild.channels.fetch(welcomeChannelId).catch(() => null);
            if (channel) {
                const bannerBuffer = await createWelcomeBanner(member.displayAvatarURL({ extension: 'png', size: 256 }), user.username);
                if (bannerBuffer) {
                    const attachment = new AttachmentBuilder(bannerBuffer, { name: 'welcome-banner.jpg' });
                    await channel.send({ files: [attachment] }).catch(err => console.error('[Welcome] Failed to send welcome banner:', err));
                }
            }
        }

        // --- 2. Process Referral ---
        db.prepare('INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)').run(member.id, user.username);

        try {
            const fetchedInvites = await guild.invites.fetch();
            const currentInvites = new Map();
            fetchedInvites.forEach(invite => {
                currentInvites.set(invite.code, invite.uses);
            });

            const usedInvite = fetchedInvites.find(inv => inv.uses > (invites.get(guild.id)?.get(inv.code) || 0));

            invites.set(guild.id, currentInvites);
            
            if (!usedInvite || usedInvite.inviter.bot) {
                console.log(`[guildMemberAdd] User ${user.tag} joined, but the invite could not be determined or was from a bot.`);
                return;
            }

            const inviterId = usedInvite.inviter.id;
            const JOIN_BONUS = 2;

            db.prepare('UPDATE users SET referred_by = ? WHERE user_id = ?').run(inviterId, member.id);
            
            economyManager.modifySolyx(inviterId, guild.id, JOIN_BONUS, `Referral bonus for ${user.tag}`);

            console.log(`[guildMemberAdd] Awarded ${JOIN_BONUS} Solyx to ${usedInvite.inviter.tag} for referring ${user.tag}.`);
            
            const inviter = await client.users.fetch(inviterId).catch(() => null);
            if(inviter) {
                const embed = new EmbedBuilder()
                    .setColor('#2ECC71')
                    .setTitle('🎉 New Referral! 🎉')
                    .setDescription(`**${user.tag}** joined using your invite link!`)
                    .addFields({ name: 'Bonus Awarded', value: `You have received **${JOIN_BONUS.toLocaleString()}** Solyx™.` });
                await inviter.send({ embeds: [embed] }).catch(e => console.error(`Could not DM inviter ${inviter.tag}: ${e.message}`));
            }

        } catch (error) {
            console.error(`[guildMemberAdd] Could not process referral for ${user.tag}:`, error);
        }
    },
};