// src/utils/publicCommandListManager.js
const db = require('./database');
const { createPublicCommandListEmbed } = require('../components/publicCommandList');
const { getRandomGif } = require('./dashboardHelpers');

/**
 * Posts or updates the public command list dashboard in its configured channel.
 * @param {import('discord.js').Client} client The Discord client instance.
 * @param {string} [specificGuildId] Optional: The ID of a specific guild to update.
 */
async function sendOrUpdateCommandList(client, specificGuildId = null) {
    const guildsToUpdate = specificGuildId ? [[specificGuildId, await client.guilds.fetch(specificGuildId).catch(() => null)]] : client.guilds.cache;

    for (const [guildId, guild] of guildsToUpdate) {
        if (!guild) continue;

        const channelId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'public_cmd_list_channel_id'").get(guildId)?.value;
        if (!channelId) continue;

        try {
            const channel = await guild.channels.fetch(channelId);
            let messageId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'public_cmd_list_message_id'").get(guildId)?.value;
            
            const gifUrl = getRandomGif();
            const embed = createPublicCommandListEmbed(gifUrl);

            let message;
            if (messageId) {
                message = await channel.messages.fetch(messageId).catch(() => null);
            }

            if (message) {
                await message.edit({ embeds: [embed] });
            } else {
                const newMessage = await channel.send({ embeds: [embed] });
                db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'public_cmd_list_message_id', ?)").run(guildId, newMessage.id);
            }
        } catch (error) {
            console.error(`[CommandList] Failed to update command list for guild ${guildId}:`, error);
            if (error.code === 10008) { // Unknown Message
                db.prepare("DELETE FROM settings WHERE guild_id = ? AND key = 'public_cmd_list_message_id'").run(guildId);
            }
        }
    }
}

module.exports = { sendOrUpdateCommandList };