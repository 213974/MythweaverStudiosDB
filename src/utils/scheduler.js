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
        } catch (error) {
            console.error(`[Scheduler] Failed to process ended raffle ${raffle.raffle_id}:`, error);
        }
    }
}

async function updateAnalyticsDashboard(client) {
    // Get all guilds the bot is in
    const guilds = client.guilds.cache;

    for (const [guildId, guild] of guilds) {
        const channelId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'analytics_channel_id'").get(guildId)?.value;
        if (!channelId) continue; // Skip this guild if no channel is set

        let messageId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'analytics_message_id'").get(guildId)?.value;

        try {
            const channel = await client.channels.fetch(channelId);
            const dashboardContent = createAnalyticsEmbed(guildId); // Pass the guildId
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

module.exports = { startScheduler, shuffle }; // Export shuffle for raffleHandler