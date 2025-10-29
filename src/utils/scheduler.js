// src/utils/scheduler.js
const { ActionRowBuilder } = require('discord.js');
const db = require('./database');
const { createAnalyticsEmbed } = require('../managers/analyticsManager');
const { drawRaffleWinners } = require('../managers/raffleManager');
const { sendOrUpdateLeaderboard } = require('../managers/leaderboardManager');
const { sendOrUpdateDashboard } = require('../managers/dashboardManager');
const { sendOrUpdateCommandList } = require('../managers/publicCommandListManager');
const taxManager = require('../managers/taxManager');
const guildhallManager = require('../managers/guildhallManager');
const dropManager = require('../managers/dropManager');
const { parseISO } = require('date-fns');

let lastDropCheck = Date.now();

async function checkSolyxDrops(client) {
    const now = Date.now();
    for (const [guildId, guild] of client.guilds.cache) {
        const settings = dropManager.getDropSettings(guildId);
        if (!settings.enabled || settings.channels.length === 0) continue;

        // Check if enough time has passed since the last drop
        if (now - lastDropCheck >= settings.interval * 60 * 1000) {
            lastDropCheck = now; // Reset timer immediately

            let eligibleChannels = [];
            if (settings.channelMode === 'whitelist') {
                eligibleChannels = settings.channels;
            } else { // blacklist
                const allTextChannelIds = guild.channels.cache
                    .filter(c => c.isTextBased() && !c.isVoiceBased())
                    .map(c => c.id);
                eligibleChannels = allTextChannelIds.filter(id => !settings.channels.includes(id));
            }

            if (eligibleChannels.length > 0) {
                const randomChannelId = eligibleChannels[Math.floor(Math.random() * eligibleChannels.length)];
                const channel = await client.channels.fetch(randomChannelId).catch(() => null);
                if (channel) {
                    console.log(`[Scheduler] Triggering Solyx Drop in #${channel.name} for guild ${guild.name}.`);
                    await dropManager.initiateDrop(client, channel);
                }
            }
        }
    }
}

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

/**
 * Checks all clans in all guilds for expired tax periods and resets them on the 1st of the month.
 * @param {import('discord.js').Client} client The Discord client instance.
 */
async function checkAndResetTaxPeriods(client) {
    const now = new Date();
    // Only proceed if it's the first day of the month.
    if (now.getDate() !== 1) {
        return;
    }

    const guilds = client.guilds.cache;
    for (const [guildId] of guilds) {
        const allClans = taxManager.getAllClans(guildId);
        for (const clan of allClans) {
            const taxStatus = taxManager.getTaxStatus(guildId, clan.clan_id);
            const lastReset = parseISO(taxStatus.last_reset_timestamp);

            // Check if the last reset was in a previous month to prevent multiple resets on the same day.
            if (lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
                taxManager.resetTaxPeriod(guildId, clan.clan_id);
                // Trigger a dashboard update after resetting
                await guildhallManager.updateGuildhallDashboard(client, guildId, clan.clan_id);
            }
        }
    }
}


function startScheduler(client) {
    console.log('[Scheduler] Starting background tasks...');
    setTimeout(() => {
        // Initial runs on startup
        updateAnalyticsDashboard(client);
        sendOrUpdateLeaderboard(client);
        sendOrUpdateDashboard(client);
        sendOrUpdateCommandList(client);

        for (const [guildId] of client.guilds.cache) {
            guildhallManager.syncAllGuildhalls(client, guildId);
        }

    }, 5000);

    // Set intervals
    setInterval(() => checkSolyxDrops(client), 60 * 1000); // 1 min (checks if interval has passed)
    setInterval(() => checkEndedRaffles(client), 60 * 1000); // 1 min
    setInterval(() => updateRaffleMessages(client), 3000); // 3 sec
    setInterval(() => updateAnalyticsDashboard(client), 5 * 60 * 1000); // 5 mins
    setInterval(() => sendOrUpdateLeaderboard(client), 5 * 60 * 1000); // 5 mins
    setInterval(() => sendOrUpdateDashboard(client), 60 * 60 * 1000); // 1 hour for Clan Dashboard
    setInterval(() => sendOrUpdateCommandList(client), 60 * 60 * 1000); // 1 hour for Command List
    
    // Check for tax resets once every hour
    setInterval(() => checkAndResetTaxPeriods(client), 60 * 60 * 1000); // 1 hour
}

module.exports = { startScheduler, updateAnalyticsDashboard };