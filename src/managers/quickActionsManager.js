// src/managers/quickActionsManager.js
const db = require('../utils/database');
const { createQuickActionsDashboard } = require('../components/quickActions');

/**
 * Deletes the old Quick Actions dashboard and posts a new one in its configured channel.
 * @param {import('discord.js').Client} client The Discord client instance.
 * @param {string} guildId The ID of the guild.
 */
async function sendOrUpdateQuickActions(client, guildId) {
    const channelId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'quick_actions_channel_id'").get(guildId)?.value;
    if (!channelId) return;

    try {
        const channel = await client.channels.fetch(channelId);
        const messageId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'quick_actions_message_id'").get(guildId)?.value;

        // Delete the old message if it exists
        if (messageId) {
            const oldMessage = await channel.messages.fetch(messageId).catch(() => null);
            if (oldMessage) {
                await oldMessage.delete().catch(() => {});
            }
        }

        // Send a new dashboard
        const dashboard = createQuickActionsDashboard();
        const newMessage = await channel.send(dashboard);

        // Save the new message ID
        db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'quick_actions_message_id', ?)").run(guildId, newMessage.id);
    } catch (error) {
        console.error('[QuickActionsManager] Failed to send or update dashboard:', error);
    }
}

module.exports = { sendOrUpdateQuickActions };