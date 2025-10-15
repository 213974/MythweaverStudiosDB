// src/events/messageReactionAdd.js
const { Events } = require('discord.js');
const db = require('../utils/database');
const { isEligibleForPerks } = require('../utils/perksManager');

module.exports = {
    name: Events.MessageReactionAdd,
    async execute(reaction, user) {
        if (user.bot) return;

        const message = reaction.message;
        // Ensure the message is cached
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('Something went wrong when fetching the reaction:', error);
                return;
            }
        }
        if (message.partial) {
            try {
                await message.fetch();
            } catch (error) {
                console.error('Something went wrong when fetching the message:', error);
                return;
            }
        }

        // --- Feature Logic ---

        // 1. User is trying to SET/UPDATE their perk by reacting to their own message
        if (message.author.id === user.id) {
            const member = await message.guild.members.fetch(user.id).catch(() => null);
            if (!member) return;

            const isEligible = await isEligibleForPerks(member);
            if (!isEligible) return;

            const emojiIdentifier = reaction.emoji.id || reaction.emoji.name;
            
            db.prepare(
                `INSERT OR REPLACE INTO booster_perks (guild_id, user_id, emoji) VALUES (?, ?, ?)`
            ).run(message.guild.id, user.id, emojiIdentifier);

            await user.send(`Your booster auto-reaction has been set to: ${reaction.emoji}`).catch(() => {
                // If DMs are off, send an ephemeral follow-up in the channel
                message.reply({ content: `Your booster auto-reaction has been set to: ${reaction.emoji}`, flags: 64 }).catch(() => {});
            });
            return; // End execution here
        }

        // 2. User is trying to REMOVE their perk
        const botReactions = message.reactions.cache.filter(r => r.users.cache.has(message.client.user.id));
        const userIsAuthor = message.author.id === user.id;

        if (userIsAuthor && botReactions.some(r => r.emoji.id === reaction.emoji.id || r.emoji.name === reaction.emoji.name)) {
            db.prepare(
                `DELETE FROM booster_perks WHERE guild_id = ? AND user_id = ?`
            ).run(message.guild.id, user.id);
            
            await user.send(`Your booster auto-reaction has been removed.`).catch(() => {
                message.reply({ content: `Your booster auto-reaction has been removed.`, flags: 64 }).catch(() => {});
            });
        }
    },
};