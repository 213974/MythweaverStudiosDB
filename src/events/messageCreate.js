// src/events/messageCreate.js
const { Events, MessageType } = require('discord.js');
const config = require('../config');
const db = require('../utils/database');
const { updateAnalyticsDashboard } = require('../utils/scheduler');
const { sendOrUpdateDashboard } = require('../utils/dashboardManager');
const { sendOrUpdateLeaderboard } = require('../utils/leaderboardManager');
const economyManager = require('../utils/economyManager');

const PANDA_YAY_EMOJI = '<:PandaYay:1357806568535490812>';
const MENTION_COOLDOWN_DURATION = 2500;
const EVENT_COOLDOWN_SECONDS = 10;

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        // --- Event "Solyx per Message" Logic ---
        const activeEvent = client.activeEvents.get(message.guild.id);
        if (activeEvent && activeEvent.type === 'message') {
            const now = Date.now();
            const endTimestampMs = activeEvent.endTimestamp * 1000;

            if (now > endTimestampMs) {
                // Event is expired but not yet cleaned up by scheduler, so we ignore it.
                client.activeEvents.delete(message.guild.id);
            } else {
                const cooldownKey = `${message.guild.id}-${message.author.id}`;
                const userCooldown = client.eventCooldowns.get(cooldownKey);
                
                if (!userCooldown || now > userCooldown) {
                    economyManager.addEventBalance(message.author.id, message.guild.id, activeEvent.reward);
                    client.eventCooldowns.set(cooldownKey, now + EVENT_COOLDOWN_SECONDS * 1000);
                }
            }
        }

        // --- Manual Refresh Triggers ---
        const guildId = message.guild.id;
        if (config.ownerIDs.includes(message.author.id)) {
            const analyticsChannelId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'analytics_channel_id'").get(guildId)?.value;
            if (message.channel.id === analyticsChannelId) {
                const messageId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'analytics_message_id'").get(guildId)?.value;
                if (messageId) {
                    const oldMessage = await message.channel.messages.fetch(messageId).catch(() => null);
                    if (oldMessage) await oldMessage.delete().catch(() => {});
                }
                await updateAnalyticsDashboard(client, guildId);
            }

            const clanDashChannelId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'dashboard_channel_id'").get(guildId)?.value;
            if (message.channel.id === clanDashChannelId) {
                const messageId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'dashboard_message_id'").get(guildId)?.value;
                if (messageId) {
                    const oldMessage = await message.channel.messages.fetch(messageId).catch(() => null);
                    if (oldMessage) await oldMessage.delete().catch(() => {});
                }
                await sendOrUpdateDashboard(client, guildId);
            }

            const leaderboardChannelId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'leaderboard_channel_id'").get(guildId)?.value;
            if (message.channel.id === leaderboardChannelId) {
                const messageId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'leaderboard_message_id'").get(guildId)?.value;
                if (messageId) {
                    const oldMessage = await message.channel.messages.fetch(messageId).catch(() => null);
                    if (oldMessage) await oldMessage.delete().catch(() => {});
                }
                await sendOrUpdateLeaderboard(client, guildId);
            }

            const helpChannelId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'help_dashboard_channel_id'").get(guildId)?.value;
            if (message.channel.id === helpChannelId) {
                // Use a timeout to prevent spam and allow for a small conversation buffer
                clearTimeout(client.helpDashboardTimeout);
                client.helpDashboardTimeout = setTimeout(async () => {
                    try {
                        const messageId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'help_dashboard_message_id'").get(guildId)?.value;
                        if (messageId) {
                            const oldMessage = await message.channel.messages.fetch(messageId).catch(() => null);
                            if (oldMessage) await oldMessage.delete().catch(() => {});
                        }
                        
                        const { createHelpDashboard } = require('../commands/help'); // Re-require to avoid circular dependency issues
                        const dashboard = createHelpDashboard();
                        const newMessage = await message.channel.send(dashboard);
                        db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'help_dashboard_message_id', ?)").run(guildId, newMessage.id);
                    } catch (error) {
                        console.error('[HelpDashboard] Failed to re-post help dashboard:', error);
                    }
                }, 30000); // 30-second delay
            }
        }

        // --- Bot Mention Response ---
        const isReplyToBot = message.type === MessageType.Reply && message.mentions.repliedUser?.id === client.user.id;
        const isDirectMention = message.mentions.has(client.user.id);

        if (isDirectMention && !isReplyToBot) {
            const now = Date.now();
            if (now - (client.lastPandaMentionResponse || 0) > MENTION_COOLDOWN_DURATION) {
                try {
                    await message.channel.send(PANDA_YAY_EMOJI);
                    client.lastPandaMentionResponse = now;
                } catch (error) {
                    console.error(`Failed to send PandaYay emoji:`, error);
                }
            }
        }
    },
};