// src/utils/scheduler.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const db = require('./database');
const { createAnalyticsEmbed } = require('./analyticsManager');

// Function to shuffle an array (Fisher-Yates shuffle)
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// CORRECTED: This function is now fully implemented.
async function checkEndedRaffles(client) {
    const now = Math.floor(Date.now() / 1000);
    const endedRaffles = db.prepare('SELECT * FROM raffles WHERE status = ? AND end_timestamp <= ?').all('active', now);

    for (const raffle of endedRaffles) {
        console.log(`[Scheduler] Processing ended raffle ID: ${raffle.raffle_id}`);
        try {
            const entries = db.prepare('SELECT user_id FROM raffle_entries WHERE raffle_id = ?').all(raffle.raffle_id);
            const channel = await client.channels.fetch(raffle.channel_id).catch(() => null);

            if (!channel) {
                db.prepare("UPDATE raffles SET status = 'ended', winner_id = 'Error: Channel not found' WHERE raffle_id = ?").run(raffle.raffle_id);
                continue;
            }

            let winners = [];
            let announcementDescription;

            if (entries.length > 0) {
                const uniqueParticipants = [...new Set(entries.map(e => e.user_id))];
                winners = shuffle(uniqueParticipants).slice(0, raffle.num_winners);
                const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
                announcementDescription = `The raffle for **${raffle.title}** has concluded! Congratulations to our winner(s):\n\n${winnerMentions}`;
            } else {
                announcementDescription = 'The raffle has ended, but there were no entries. No winners were chosen.';
            }

            db.prepare("UPDATE raffles SET status = 'ended', winner_id = ? WHERE raffle_id = ?").run(winners.join(','), raffle.raffle_id);

            const announcementEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle(`🎉 Raffle Ended: ${raffle.title} 🎉`)
                .setDescription(announcementDescription)
                .addFields(
                    { name: 'Total Unique Participants', value: (new Set(entries.map(e => e.user_id))).size.toLocaleString(), inline: true },
                    { name: 'Total Tickets', value: entries.length.toLocaleString(), inline: true }
                )
                .setTimestamp();
            
            await channel.send({ content: winners.length > 0 ? winners.map(id => `<@${id}>`).join(' ') : ' ', embeds: [announcementEmbed] });

            const originalMessage = await channel.messages.fetch(raffle.message_id).catch(() => null);
            if (originalMessage) {
                const endedEmbed = EmbedBuilder.from(originalMessage.embeds[0]).setColor('#808080').addFields({ name: 'Status', value: 'This raffle has ended.'});
                const disabledRow = ActionRowBuilder.from(originalMessage.components[0]).setComponents(ButtonBuilder.from(originalMessage.components[0].components[0]).setDisabled(true));
                await originalMessage.edit({ embeds: [endedEmbed], components: [disabledRow] });
            }
        } catch (error) {
            console.error(`[Scheduler] Failed to process raffle ID ${raffle.raffle_id}:`, error);
        }
    }
}

async function updateAnalyticsDashboard(client, specificGuildId = null) {
    // CORRECTED: The typo '.cach' has been fixed to '.cache'.
    const guilds = specificGuildId ? [[specificGuildId, await client.guilds.fetch(specificGuildId)]] : client.guilds.cache;

    for (const [guildId, guild] of guilds) {
        const channelId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'analytics_channel_id'").get(guildId)?.value;
        if (!channelId) continue;

        let messageId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'analytics_message_id'").get(guildId)?.value;

        try {
            const channel = await client.channels.fetch(channelId);
            const dashboardContent = createAnalyticsEmbed(guildId);
            let message;

            if (messageId) {
                message = await channel.messages.fetch(messageId).catch(() => null);
            }

            if (message) {
                await message.edit(dashboardContent);
            } else {
                const newMessage = await channel.send(dashboardContent);
                db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'analytics_message_id', ?)")
                    .run(guildId, newMessage.id);
            }
        } catch (error) {
            console.error(`[Scheduler] Failed to update analytics for guild ${guildId}:`, error);
            if (error.code === 10008) { // Unknown Message
                db.prepare("DELETE FROM settings WHERE guild_id = ? AND key = 'analytics_message_id'").run(guildId);
            }
        }
    }
}

function startScheduler(client) {
    console.log('[Scheduler] Starting background tasks...');
    setTimeout(() => {
        checkEndedRaffles(client);
        updateAnalyticsDashboard(client);
    }, 5000);

    setInterval(() => checkEndedRaffles(client), 60 * 1000);
    setInterval(() => updateAnalyticsDashboard(client), 5 * 60 * 1000);
}

module.exports = { startScheduler, shuffle, updateAnalyticsDashboard };