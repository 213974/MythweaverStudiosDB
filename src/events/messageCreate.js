// src/events/messageCreate.js
const { Events, MessageType } = require('discord.js');
const config = require('../config');
const db = require('../utils/database');
const { updateAnalyticsDashboard } = require('../utils/scheduler');

const PANDA_YAY_EMOJI = '<:PandaYay:1357806568535490812>';
const COOLDOWN_DURATION = 2500;

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        // --- Analytics Dashboard Refresh Trigger ---
        // Check if the author is the bot owner
        if (message.author.id === config.ownerID) {
            const analyticsChannelId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'analytics_channel_id'").get(message.guild.id)?.value;
            // Check if the message is in the configured analytics channel
            if (message.channel.id === analyticsChannelId) {
                console.log(`[Analytics] Owner message detected. Forcing refresh for guild ${message.guild.id}.`);
                const messageId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'analytics_message_id'").get(message.guild.id)?.value;
                if (messageId) {
                    // Attempt to delete the old dashboard message to force a new one.
                    const oldMessage = await message.channel.messages.fetch(messageId).catch(() => null);
                    if (oldMessage) await oldMessage.delete().catch(err => console.error("Could not delete old analytics dash:", err.message));
                }
                // Trigger an immediate update for this specific guild
                await updateAnalyticsDashboard(client, message.guild.id);
            }
        }

        // --- Bot Mention Response ---
        const isReplyToBot = message.type === MessageType.Reply && message.mentions.repliedUser?.id === client.user.id;
        const isDirectMention = message.mentions.has(client.user.id);

        if (isDirectMention && !isReplyToBot) {
            const now = Date.now();
            if (now - (client.lastPandaMentionResponse || 0) < COOLDOWN_DURATION) {
                return;
            }
            try {
                await message.channel.send(PANDA_YAY_EMOJI);
                client.lastPandaMentionResponse = now;
            } catch (error) {
                console.error(`Failed to send PandaYay emoji in channel ${message.channel.id}:`, error);
            }
        }
    },
};