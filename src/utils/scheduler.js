// src/utils/scheduler.js
const { ActionRowBuilder } = require('discord.js');
const db = require('./database');
const { createAnalyticsEmbed } = require('./analyticsManager');
const { drawRaffleWinners } = require('./raffleManager');
const { sendOrUpdateLeaderboard } = require('./leaderboardManager');

async function checkEndedRaffles(client) {
    const now = Math.floor(Date.now() / 1000);
    const endedRaffles = db.prepare('SELECT * FROM raffles WHERE status = ? AND end_timestamp <= ?').all('active', now);

    for (const raffle of endedRaffles) {
        console.log(`[Scheduler] Processing ended raffle ID: ${raffle.raffle_id}`);
        try {
            await drawRaffleWinners(client, raffle.raffle_id);
        } catch (error) {
            console.error(`[Scheduler] Failed to process raffle ID ${raffle.raffle_id}:`, error);
        }
    }
}

async function updateAnalyticsDashboard(client, specificGuildId = null) {
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
            if (error.code === 10008) {
                db.prepare("DELETE FROM settings WHERE guild_id = ? AND key = 'analytics_message_id'").run(guildId);
            }
        }
    }
}

async function updateRaffleMessages(client) {
    if (client.raffleUpdateQueue.size === 0) return;

    const rafflesToUpdate = new Set(client.raffleUpdateQueue);
    client.raffleUpdateQueue.clear();

    for (const raffleId of rafflesToUpdate) {
        try {
            const raffle = db.prepare('SELECT channel_id, message_id FROM raffles WHERE raffle_id = ?').get(raffleId);
            if (!raffle || !raffle.message_id) continue;

            const channel = await client.channels.fetch(raffle.channel_id).catch(() => null);
            if (!channel) continue;

            const message = await channel.messages.fetch(raffle.message_id).catch(() => null);
            if (!message || message.components.length === 0) continue;

            const entryCount = db.prepare('SELECT COUNT(DISTINCT user_id) as count FROM raffle_entries WHERE raffle_id = ?').get(raffleId).count;
            const updatedRow = ActionRowBuilder.from(message.components[0]);
            const participantsButton = updatedRow.components.find(c => c.customId === `raffle_entries_${raffleId}`);

            if (participantsButton && participantsButton.label !== `Participants: ${entryCount}`) {
                participantsButton.setLabel(`Participants: ${entryCount}`);
                await message.edit({ components: [updatedRow] });
            }
        } catch (error) {
            console.error(`[RaffleUpdater] Failed to update message for raffle ID ${raffleId}:`, error);
        }
    }
}

async function checkEndedEvents(client) {
    const now = Math.floor(Date.now() / 1000);
    const expiredEvents = db.prepare("SELECT guild_id FROM settings WHERE key = 'event_end_timestamp' AND value <= ?").all(now);

    for (const event of expiredEvents) {
        const guildId = event.guild_id;
        console.log(`[Scheduler] Cleaning up expired event for guild ${guildId}...`);
        db.prepare("DELETE FROM settings WHERE guild_id = ? AND key LIKE 'event_%'").run(guildId);
        if (client.activeEvents) {
            client.activeEvents.delete(guildId);
        }
    }
}

function startScheduler(client) {
    console.log('[Scheduler] Starting background tasks...');
    setTimeout(() => {
        checkEndedRaffles(client);
        updateAnalyticsDashboard(client);
        sendOrUpdateLeaderboard(client); // Initial run for all guilds
    }, 5000);

    setInterval(() => checkEndedRaffles(client), 60 * 1000);
    setInterval(() => updateAnalyticsDashboard(client), 5 * 60 * 1000); // Update every 5 mins
    setInterval(() => updateRaffleMessages(client), 3000);
    setInterval(() => sendOrUpdateLeaderboard(client), 5 * 60 * 1000); // Update every 5 mins
}

module.exports = { startScheduler, updateAnalyticsDashboard };