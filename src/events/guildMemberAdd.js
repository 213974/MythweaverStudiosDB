// src/events/guildMemberAdd.js
const { Events, EmbedBuilder } = require('discord.js');
const db = require('../utils/database');
const economyManager = require('../managers/economyManager');
const { sendWelcomeMessage } = require('../managers/welcomeManager');

const invites = new Map();

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member, client) {
        const { guild, user } = member;

        // --- 1. Send Welcome Banner (now handled by a manager) ---
        await sendWelcomeMessage(member);

        // --- 2. Process Referral ---
        db.prepare(`
            INSERT INTO users (user_id, username, referred_by) 
            VALUES (?, ?, NULL) 
            ON CONFLICT(user_id) DO UPDATE SET username = excluded.username
        `).run(member.id, user.username);


        try {
            const fetchedInvites = await guild.invites.fetch();
            const currentInvites = new Map();
            fetchedInvites.forEach(invite => {
                currentInvites.set(invite.code, invite.uses);
            });

            const usedInvite = fetchedInvites.find(inv => inv.uses > (invites.get(guild.id)?.get(inv.code) || 0));

            invites.set(guild.id, currentInvites);
            
            if (!usedInvite || usedInvite.inviter.bot) {
                return;
            }

            const inviterId = usedInvite.inviter.id;
            const inviter = usedInvite.inviter;
            const JOIN_BONUS = 2;

            db.prepare('UPDATE users SET referred_by = ? WHERE user_id = ?').run(inviterId, member.id);
            
            economyManager.modifySolyx(inviterId, guild.id, JOIN_BONUS, `Referral bonus for ${user.tag}`);
            
            console.log(`[guildMemberAdd] Awarded ${JOIN_BONUS} Solyx to ${inviter.tag} (${inviter.id}) for referring ${user.tag}.`);
            
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