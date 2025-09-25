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

        // On startup, fetch all invites and store them
        if (invites.size === 0) {
            try {
                const fetchedInvites = await member.guild.invites.fetch();
                fetchedInvites.forEach(invite => {
                    invites.set(invite.code, invite.uses);
                });
                console.log('[guildMemberAdd] Initialized invite cache.');
            } catch (error)
            {
                console.error('[guildMemberAdd] Could not fetch invites on init:', error);
            }
        }

        // To compare, we need to fetch the current invites on every join
        const newInvites = await member.guild.invites.fetch();

        // Find the invite that was used
        const usedInvite = newInvites.find(inv => inv.uses > (invites.get(inv.code) || 0));
        
        // Update the cache with the new uses
        newInvites.forEach(invite => {
            invites.set(invite.code, invite.uses);
        });

        if (!usedInvite || usedInvite.inviter.bot) {
            console.log(`[guildMemberAdd] User ${member.user.tag} joined, but the invite could not be determined or was from a bot.`);
            return;
        }

        const inviterId = usedInvite.inviter.id;
        const newMemberId = member.id;
        const JOIN_BONUS = 20; // As per GDD

        try {
            // Update the new member's record with who referred them
            db.prepare('UPDATE users SET referred_by = ? WHERE user_id = ?').run(inviterId, newMemberId);

            // Award the bonus to the inviter
            const inviterWallet = economyManager.getWallet(inviterId, member.guild.id);
            // Award the bonus
            db.prepare('UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND guild_id = ?').run(JOIN_BONUS, inviterId, member.guild.id);

            // Log the transaction
            db.prepare('INSERT INTO transactions (user_id, guild_id, amount, reason, timestamp) VALUES (?, ?, ?, ?, ?)')
                .run(inviterId, member.guild.id, JOIN_BONUS, `Referral bonus for ${member.user.tag}`, new Date().toISOString());

            console.log(`[guildMemberAdd] Awarded ${JOIN_BONUS} Solyx to ${usedInvite.inviter.tag} for referring ${member.user.tag}.`);
            
            // Optional: DM the inviter
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
            console.error(`[guildMemberAdd] Database error during referral processing:`, error);
        }
    },
};