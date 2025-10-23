// src/events/guildMemberAdd.js
const { Events, EmbedBuilder } = require('discord.js');
const db = require('../utils/database');
const economyManager = require('../utils/economyManager');

const invites = new Map();

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member, client) {
        db.prepare('INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)').run(member.id, member.user.username);

        try {
            const fetchedInvites = await member.guild.invites.fetch();
            const currentInvites = new Map();
            fetchedInvites.forEach(invite => {
                currentInvites.set(invite.code, invite.uses);
            });

            const usedInvite = fetchedInvites.find(inv => inv.uses > (invites.get(member.guild.id)?.get(inv.code) || 0));

            invites.set(member.guild.id, currentInvites);
            
            if (!usedInvite || usedInvite.inviter.bot) {
                console.log(`[guildMemberAdd] User ${member.user.tag} joined, but the invite could not be determined or was from a bot.`);
                return;
            }

            const inviterId = usedInvite.inviter.id;
            const newMemberId = member.id;
            const JOIN_BONUS = 2; // Kept as a constant here as it's not a configurable system reward.

            db.prepare('UPDATE users SET referred_by = ? WHERE user_id = ?').run(inviterId, newMemberId);
            
            // Changed from the old `addSolyx` to the new, correct `modifySolyx` function.
            economyManager.modifySolyx(inviterId, member.guild.id, JOIN_BONUS, `Referral bonus for ${member.user.tag}`);

            console.log(`[guildMemberAdd] Awarded ${JOIN_BONUS} Solyx to ${usedInvite.inviter.tag} for referring ${member.user.tag}.`);
            
            const inviter = await client.users.fetch(inviterId).catch(() => null);
            if(inviter) {
                const embed = new EmbedBuilder()
                    .setColor('#2ECC71')
                    .setTitle('🎉 New Referral! 🎉')
                    .setDescription(`**${member.user.tag}** joined using your invite link!`)
                    .addFields({ name: 'Bonus Awarded', value: `You have received **${JOIN_BONUS.toLocaleString()}** Solyx™.` });
                await inviter.send({ embeds: [embed] }).catch(e => console.error(`Could not DM inviter ${inviter.tag}: ${e.message}`));
            }

        } catch (error) {
            console.error(`[guildMemberAdd] Could not process referral for ${member.user.tag}:`, error);
        }
    },
};