// src/utils/leaderboardManager.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('./database');
const economyManager = require('./economyManager');
const { formatTimestamp } = require('../utils/timestampFormatter');

function createLeaderboardEmbed(guild, topUsers) {
    const nextUpdateTimestamp = Math.floor((Date.now() + 5 * 60 * 1000) / 1000);
    let descriptionString = '';

    if (topUsers.length === 0) {
        descriptionString = 'The leaderboard is currently empty. Start earning Solyx™ to get on the board!';
    } else {
        // --- THIS IS THE FIX ---
        // Top 3 ranks now use Markdown headers for increased size.
        descriptionString = topUsers.map((user, index) => {
            const medals = ['🥇', '🥈', '🥉'];
            const rankText = `<@${user.user_id}> - **${user.balance.toLocaleString()}** 🪙`;
            if (index === 0) return `# ${medals[0]} ${rankText}`;
            if (index === 1) return `## ${medals[1]} ${rankText}`;
            if (index === 2) return `### ${medals[2]} ${rankText}`;
            return `#${index + 1} ${rankText}`;
        }).join('\n');
    }

    descriptionString += `\n\n*Updates ${formatTimestamp(nextUpdateTimestamp, 'R')}*`;

    const embed = new EmbedBuilder()
        .setColor('#ff8100')
        .setTitle(`Solyx™ Leaderboard`)
        .setThumbnail(guild.iconURL())
        .setDescription(descriptionString)
        .setTimestamp();

    return embed;
}

function createLeaderboardComponents() {
    const button = new ButtonBuilder()
        .setCustomId('leaderboard_check_rank')
        .setLabel('Check My Rank')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🏆');
    return new ActionRowBuilder().addComponents(button);
}

// --- THIS IS THE FIX ---
// The function now iterates through all guilds, making it compatible with the scheduler.
async function sendOrUpdateLeaderboard(client, specificGuildId = null) {
    const guildsToUpdate = specificGuildId ? [[specificGuildId, await client.guilds.fetch(specificGuildId)]] : client.guilds.cache;

    for (const [guildId, guild] of guildsToUpdate) {
        const channelId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'leaderboard_channel_id'").get(guildId)?.value;
        if (!channelId) continue;

        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (!channel) continue;

        let messageId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'leaderboard_message_id'").get(guildId)?.value;
        
        const topUsers = economyManager.getTopUsers(guildId, 25);
        const embed = createLeaderboardEmbed(guild, topUsers);
        const components = createLeaderboardComponents();

        try {
            let message;
            if (messageId) {
                message = await channel.messages.fetch(messageId).catch(() => null);
            }

            if (message) {
                await message.edit({ embeds: [embed], components: [components] });
            } else {
                const newMessage = await channel.send({ embeds: [embed], components: [components] });
                db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'leaderboard_message_id', ?)").run(guildId, newMessage.id);
            }
        } catch (error) {
            console.error(`[Leaderboard] Failed to update leaderboard for guild ${guildId}:`, error);
            if (error.code === 10008) { // Unknown Message
                db.prepare("DELETE FROM settings WHERE guild_id = ? AND key = 'leaderboard_message_id'").run(guildId);
            }
        }
    }
}

module.exports = { sendOrUpdateLeaderboard };