// src/utils/leaderboardManager.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('./database');
const economyManager = require('./economyManager');
const { formatTimestamp } = require('../utils/timestampFormatter');

const GIFS = [
    'https://i.pinimg.com/originals/56/34/9f/56349f764173af321a640f6e1bac22fd.gif',
    'https://i.pinimg.com/originals/a6/10/8b/a6108b31b391378d30856edba57172a4.gif',
    'https://i.pinimg.com/originals/9d/3e/2f/9d3e2f3f2e46a9f4dd0a016415433af8.gif',
    'https://i.pinimg.com/originals/0f/43/10/0f4310bc3442432f7667605968cc9e80.gif',
    'https://i.pinimg.com/originals/92/97/74/929774b033a66c070f5da21ef21c0090.gif',
    'https://i.pinimg.com/originals/d2/85/69/d285699262b0a27472b3fa8f7352c145.gif',
    'https://i.pinimg.com/originals/a3/63/9b/a3639be246d40f97fddbcd888b1b1a60.gif'
];

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
    
    const randomGif = GIFS[Math.floor(Math.random() * GIFS.length)];

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
            
            // 1. Fetch the top users from the database.
            const topUsersFromDb = economyManager.getTopUsers(guildId, 50);

            // --- THIS IS THE FIX ---
            // Before filtering, we ensure the top users from the DB are present in the guild's member cache.
            // This prevents the cache from being stale and incorrectly filtering out active members.
            if (topUsersFromDb.length > 0) {
                await guild.members.fetch({ user: topUsersFromDb.map(u => u.user_id) }).catch(() => {
                    console.warn(`[Leaderboard] Could not fetch all top members for guild ${guildId}. Some may be missing.`);
                });
            }

            // 2. Filter the list by checking against the now-populated cache.
            const filteredTopUsers = topUsersFromDb.filter(user => guild.members.cache.has(user.user_id));

            // 3. Take the top 25 from the now-filtered list.
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
            if (error.code === 10008) { // Unknown Message
                db.prepare("DELETE FROM settings WHERE guild_id = ? AND key = 'leaderboard_message_id'").run(guildId);
            }
        }
    }
}

module.exports = { sendOrUpdateLeaderboard };