// src/managers/leaderboardManager.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/database');
const economyManager = require('./economyManager');
const { formatTimestamp } = require('../helpers/timestampFormatter');
const { getRandomGif } = require('../helpers/dashboardHelpers');

function createLeaderboardEmbed(guild, topUsers) {
    const nextUpdateTimestamp = Math.floor((Date.now() + 5 * 60 * 1000) / 1000);
    let descriptionString = '';

    if (topUsers.length === 0) {
        descriptionString = 'The leaderboard is currently empty. Start earning Solyx™ to get on the board!';
    } else {
        descriptionString = topUsers.map((user, index) => {
            const medals = ['🥇', '🥈', '🥉'];
            const rankText = `<@${user.user_id}> - **${user.balance.toLocaleString()}** <a:Yellow_Gem:1427764380489224295>`;
            if (index === 0) return `# ${medals[0]} ${rankText}`;
            if (index === 1) return `## ${medals[1]} ${rankText}`;
            if (index === 2) return `### ${medals[2]} ${rankText}`;
            return `#${index + 1} ${rankText}`;
        }).join('\n');
    }

    descriptionString += `\n\n*Updates ${formatTimestamp(nextUpdateTimestamp, 'R')}*`;
    
    const randomGif = getRandomGif();

    const embed = new EmbedBuilder()
        .setColor('#ff8100')
        .setTitle(`<a:Yellow_Crown:1427764440689938634> Solyx™ Leaderboard <a:Yellow_Crown:1427764440689938634>`)
        .setDescription(descriptionString)
        .setImage(randomGif)
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

async function sendOrUpdateLeaderboard(client, specificGuildId = null) {
    const guildsToUpdate = specificGuildId ? [[specificGuildId, await client.guilds.fetch(specificGuildId)]] : client.guilds.cache;

    for (const [guildId, guild] of guildsToUpdate) {
        const channelId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'leaderboard_channel_id'").get(guildId)?.value;
        if (!channelId) continue;

        try {
            const channel = await guild.channels.fetch(channelId);
            let messageId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'leaderboard_message_id'").get(guildId)?.value;
            
            const topUsersFromDb = economyManager.getTopUsers(guildId, 50);

            if (topUsersFromDb.length > 0) {
                await guild.members.fetch({ user: topUsersFromDb.map(u => u.user_id) }).catch(() => {
                    console.warn(`[Leaderboard] Could not fetch all top members for guild ${guildId}. Some may be missing.`);
                });
            }

            const filteredTopUsers = topUsersFromDb.filter(user => guild.members.cache.has(user.user_id));
            const finalTopUsers = filteredTopUsers.slice(0, 25);

            const embed = createLeaderboardEmbed(guild, finalTopUsers);
            const components = createLeaderboardComponents();

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
            if (error.code === 10008) {
                db.prepare("DELETE FROM settings WHERE guild_id = ? AND key = 'leaderboard_message_id'").run(guildId);
            }
        }
    }
}

module.exports = { sendOrUpdateLeaderboard };
