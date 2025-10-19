// src/events/guildMemberAdd.js
const { Events, EmbedBuilder } = require('discord.js');
const db = require('../utils/database');
const economyManager = require('../utils/economyManager');

// A simple in-memory cache to store invites before and after a join
const invites = new Map();

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member, client) {
        // Ensure the user is in the database immediately upon joining.
        db.prepare('INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)').run(member.id, member.user.username);

        try {
            const fetchedInvites = await member.guild.invites.fetch();
            const currentInvites = new Map();
            fetchedInvites.forEach(invite => {
                currentInvites.set(invite.code, invite.uses);
            });

            // Find the invite that was used
            const usedInvite = fetchedInvites.find(inv => inv.uses > (invites.get(member.guild.id)?.get(inv.code) || 0));

            // Update the global cache
            invites.set(member.guild.id, currentInvites);
            
            if (!usedInvite || usedInvite.inviter.bot) {
                console.log(`[guildMemberAdd] User ${member.user.tag} joined, but the invite could not be determined or was from a bot.`);
                return;
            }

            const inviterId = usedInvite.inviter.id;
            const newMemberId = member.id;
            // --- ECONOMY RE-BALANCE: Bonus reduced by a factor of 10 ---
            const JOIN_BONUS = 2;

            db.prepare('UPDATE users SET referred_by = ? WHERE user_id = ?').run(inviterId, newMemberId);
            
            // --- REFACTOR: Use the centralized addSolyx function ---
            economyManager.addSolyx(inviterId, member.guild.id, JOIN_BONUS, `Referral bonus for ${member.user.tag}`);

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