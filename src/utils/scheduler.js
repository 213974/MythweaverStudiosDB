// src/utils/scheduler.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const db = require('./database');
const { createAnalyticsEmbed } = require('./analyticsManager');
const { drawRaffleWinners } = require('./raffleManager');

async function syncClanOwnerRoles(client) {
    try {
        const allClans = db.prepare('SELECT guild_id, clan_id, owner_id FROM clans').all();
        for (const clan of allClans) {
            const guild = await client.guilds.fetch(clan.guild_id).catch(() => null);
            if (!guild) continue;

            const owner = await guild.members.fetch(clan.owner_id).catch(() => null);
            if (!owner) continue; // Owner may have left the server

            if (!owner.roles.cache.has(clan.clan_id)) {
                const clanRole = await guild.roles.fetch(clan.clan_id).catch(() => null);
                if (clanRole) {
                    console.log(`[Scheduler] Correcting missing role for clan owner ${owner.user.tag} in guild ${guild.name}.`);
                    await owner.roles.add(clanRole);
                }
            }
        }
    } catch (error) {
        console.error('[Scheduler] Error during clan owner role synchronization:', error);
    }
}

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
            // All complex logic for drawing winners, sending messages, and editing
            // the original post is now handled by the centralized raffleManager.
            await drawRaffleWinners(client, raffle.raffle_id);
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
        syncClanOwnerRoles(client);
    }, 5000);

    setInterval(() => checkEndedRaffles(client), 60 * 1000); 
    setInterval(() => updateAnalyticsDashboard(client), 5 * 60 * 1000); // Every 5 minutes
    setInterval(() => syncClanOwnerRoles(client), 60 * 1000); // Every minute
}

module.exports = { startScheduler, shuffle, updateAnalyticsDashboard };