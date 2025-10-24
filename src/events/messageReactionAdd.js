// src/events/messageReactionAdd.js
const { Events } = require('discord.js');
const db = require('../utils/database');
const { isEligibleForPerks } = require('../managers/perksManager');

async function sendTemporaryReply(message, content) {
    const reply = await message.channel.send(content);
    setTimeout(() => reply.delete().catch(() => {}), 7500); // Delete after 7.5 seconds
}

module.exports = {
    name: Events.MessageReactionAdd,
    async execute(reaction, user, client) {
        if (!client.user || user.bot) return;
        
        try {
            if (reaction.partial) await reaction.fetch();
            if (reaction.message.partial) await reaction.message.fetch();
        } catch (error) {
            console.error('Failed to fetch reaction/message:', error);
            return;
        }

        if (!reaction.emoji) {
            console.warn('[ReactionAdd] Received a reaction event without an emoji object. Aborting.');
            return;
        }

        const { message } = reaction;

        // Block 1: Check for REMOVAL condition first.
        const botReactions = message.reactions.cache.filter(r => r.users.cache.has(client.user.id));
        if (message.author.id === user.id && botReactions.some(r => (r.emoji.id || r.emoji.name) === (reaction.emoji.id || reaction.emoji.name))) {
            db.prepare(`DELETE FROM booster_perks WHERE guild_id = ? AND user_id = ?`).run(message.guild.id, user.id);
            await sendTemporaryReply(message, `-# ${user}, your booster auto-reaction emoji has been removed.`);
            return; // --- ADDED --- Stop further execution after removal.
        }
        
        // Block 2: Only if it's not a removal, check for SET/UPDATE condition.
        if (message.author.id === user.id) {
            const member = await message.guild.members.fetch(user.id).catch(() => null);
            
            if (!member) return; // Member not found, cannot check eligibility.

            if (await isEligibleForPerks(member)) {
                let finalEmoji = reaction.emoji;
                let emojiIdentifier = reaction.emoji.id || reaction.emoji.name;

                // Auto-import external emoji
                if (reaction.emoji.id && !message.guild.emojis.cache.has(reaction.emoji.id)) {
                    try {
                        // --- CORRECTED --- Use guild.emojis.create, not client.application
                        const newEmoji = await message.guild.emojis.create({
                            attachment: reaction.emoji.url,
                            name: reaction.emoji.name.substring(0, 32)
                        });
                        finalEmoji = newEmoji;
                        emojiIdentifier = newEmoji.id;
                    } catch (error) {
                        console.error('[BoosterPerk] Failed to import emoji:', error.message);
                        await sendTemporaryReply(message, `-# ${user}, I could not use that emoji. It may be from a server I cannot access, or the emoji slots for this server might be full.`);
                        return;
                    }
                }

                db.prepare(`INSERT OR REPLACE INTO booster_perks (guild_id, user_id, emoji) VALUES (?, ?, ?)`).run(message.guild.id, user.id, emojiIdentifier);
                await sendTemporaryReply(message, `-# ${user}, your booster auto-reaction emoji has been set to: ${finalEmoji}`);
            } else {
                // --- THIS IS THE NEW LOGIC ---
                // If the user is the message author but is not eligible, provide feedback.
                await sendTemporaryReply(message, `-# ${user}, you are not eligible to set a booster auto-reaction perk on this server.`);
            }
        }
    },
};