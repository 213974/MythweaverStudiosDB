// src/events/messageCreate.js
const { Events, MessageType } = require('discord.js');
const config = require('../config');
const db = require('../utils/database');
const { updateAnalyticsDashboard } = require('../utils/scheduler');
const { sendOrUpdateDashboard } = require('../utils/dashboardManager');
const { sendOrUpdateLeaderboard } = require('../utils/leaderboardManager'); // Import leaderboard manager

const PANDA_YAY_EMOJI = '<:PandaYay:1357806568535490812>';
const COOLDOWN_DURATION = 2500;

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        // --- Manual Refresh Triggers ---
        const guildId = message.guild.id;

        // Check for bot owner actions
        if (config.ownerIDs.includes(message.author.id)) {
            // -- Analytics Dashboard Refresh Trigger --
            const analyticsChannelId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'analytics_channel_id'").get(guildId)?.value;
            if (message.channel.id === analyticsChannelId) {
                console.log(`[Analytics] Owner message detected. Forcing refresh for guild ${guildId}.`);
                const messageId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'analytics_message_id'").get(guildId)?.value;
                if (messageId) {
                    const oldMessage = await message.channel.messages.fetch(messageId).catch(() => null);
                    if (oldMessage) await oldMessage.delete().catch(err => console.error("Could not delete old analytics dash:", err.message));
                }
                await updateAnalyticsDashboard(client, guildId);
            }

            // -- Clan Dashboard Refresh Trigger --
            const clanDashChannelId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'dashboard_channel_id'").get(guildId)?.value;
            if (message.channel.id === clanDashChannelId) {
                console.log(`[Dashboard] Owner message detected. Forcing refresh for guild ${guildId}.`);
                const messageId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'dashboard_message_id'").get(guildId)?.value;
                if (messageId) {
                    const oldMessage = await message.channel.messages.fetch(messageId).catch(() => null);
                    if (oldMessage) await oldMessage.delete().catch(err => console.error("Could not delete old clan dash:", err.message));
                }
                await sendOrUpdateDashboard(client, guildId);
            }
        }

        // --- NEW: Leaderboard Refresh Trigger for specific dev owner ---
        if (message.author.id === '431407603814367233') {
            const leaderboardChannelId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'leaderboard_channel_id'").get(guildId)?.value;
            if (message.channel.id === leaderboardChannelId) {
                console.log(`[Leaderboard] Dev owner message detected. Forcing refresh for guild ${guildId}.`);
                const messageId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'leaderboard_message_id'").get(guildId)?.value;
                if (messageId) {
                    const oldMessage = await message.channel.messages.fetch(messageId).catch(() => null);
                    if (oldMessage) await oldMessage.delete().catch(err => console.error("Could not delete old leaderboard:", err.message));
                }
                await sendOrUpdateLeaderboard(client, guildId);
            }
        }

        // --- Bot Mention Response ---
        const isReplyToBot = message.type === MessageType.Reply && message.mentions.repliedUser?.id === client.user.id;
        const isDirectMention = message.mentions.has(client.user.id);

        if (isDirectMention && !isReplyToBot) {
            const now = Date.now();
            if (now - (client.lastPandaMentionResponse || 0) > COOLDOWN_DURATION) {
                try {
                    await message.channel.send(PANDA_YAY_EMOJI);
                    client.lastPandaMentionResponse = now;
                } catch (error) {
                    console.error(`Failed to send PandaYay emoji in channel ${message.channel.id}:`, error);
                }
            }
        }
    },
};