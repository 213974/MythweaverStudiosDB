// src/events/guildMemberRemove.js
const { Events } = require('discord.js');
const db = require('../utils/database');

const LEAVE_PENALTY = -20; // A negative value representing the loss

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        // Find out if the leaving member was referred by someone
        const userRecord = db.prepare('SELECT referred_by FROM users WHERE user_id = ?').get(member.id);

        // If they have no referrer, do nothing.
        if (!userRecord || !userRecord.referred_by) {
            return;
        }

        const inviterId = userRecord.referred_by;

        // Check if the leaving member was "active" (claimed at least one daily)
        const claimRecord = db.prepare("SELECT user_id FROM claims WHERE user_id = ? AND claim_type = 'daily'").get(member.id);

        // If they never claimed a daily, they were not active. Do not apply a penalty.
        if (!claimRecord) {
            console.log(`[guildMemberRemove] User ${member.user.tag} (referred by ${inviterId}) left, but was inactive. No penalty applied.`);
            return;
        }

        // The user was active, so we apply the penalty to the inviter.
        try {
            db.transaction(() => {
                // Apply the penalty
                db.prepare('UPDATE wallets SET balance = balance + ? WHERE user_id = ?').run(LEAVE_PENALTY, inviterId);
                
                // Log the penalty transaction for accountability
                db.prepare('INSERT INTO transactions (user_id, amount, reason, timestamp) VALUES (?, ?, ?, ?)')
                    .run(inviterId, LEAVE_PENALTY, `Penalty for referred user ${member.user.tag} leaving`, new Date().toISOString());
            })();

            console.log(`[guildMemberRemove] Applied penalty of ${Math.abs(LEAVE_PENALTY)} Solyx™ to user ${inviterId} because their referred user ${member.user.tag} left the server.`);

            // Optional: DM the inviter to inform them of the penalty
            const inviter = await member.client.users.fetch(inviterId).catch(() => null);
            if (inviter) {
                await inviter.send({
                    content: `A user you referred, **${member.user.tag}**, has left the server. Because they were an active member, a penalty of **${Math.abs(LEAVE_PENALTY)} Solyx™** has been applied to your wallet.`
                }).catch(e => console.error(`Could not DM inviter ${inviterId} about the penalty: ${e.message}`));
            }

        } catch (error) {
            console.error(`[guildMemberRemove] Failed to apply penalty to user ${inviterId}:`, error);
        }
    },
};