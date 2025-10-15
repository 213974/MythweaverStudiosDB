// src/events/ready.js
const { Events, ActivityType, Collection, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { sendOrUpdateDashboard } = require('../utils/dashboardManager');
const db = require('../utils/database');
const config = require('../config');

function loadCommands(client) {
    client.commands = new Collection();
    const commandFoldersPath = path.join(__dirname, '..', 'commands');

    function findCommandFiles(dir) {
        let commandFiles = [];
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
            const filePath = path.join(dir, file.name);
            if (file.isDirectory()) {
                commandFiles = commandFiles.concat(findCommandFiles(filePath));
            } else if (file.name.endsWith('.js')) {
                commandFiles.push(filePath);
            }
        }
        return commandFiles;
    }

    const commandFiles = findCommandFiles(commandFoldersPath);
    for (const file of commandFiles) {
        delete require.cache[require.resolve(file)];
        const command = require(file);
        if (command.data && command.execute) {
            client.commands.set(command.data.name, command);
        }
    }
}

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);
        
        loadCommands(client);
        client.invites = new Map();

        // Pre-load active events from database into memory
        console.log('[Ready] Caching active events from database...');
        const activeEventSettings = db.prepare("SELECT guild_id, key, value FROM settings WHERE key LIKE 'event_%'").all();
        const eventsByGuild = {};
        for (const setting of activeEventSettings) {
            if (!eventsByGuild[setting.guild_id]) {
                eventsByGuild[setting.guild_id] = {};
            }
            eventsByGuild[setting.guild_id][setting.key] = setting.value;
        }
        for (const guildId in eventsByGuild) {
            const eventData = eventsByGuild[guildId];
            if (eventData.event_type && eventData.event_end_timestamp) {
                const endTimestamp = parseInt(eventData.event_end_timestamp, 10);
                if (Date.now() / 1000 < endTimestamp) {
                    client.activeEvents.set(guildId, {
                        type: eventData.event_type,
                        reward: parseFloat(eventData.event_reward),
                        endTimestamp: endTimestamp,
                        startedBy: eventData.event_started_by
                    });
                    console.log(`[Ready] Cached active event for guild ${guildId}.`);
                }
            }
        }

        // Multi-Guild Initialization
        console.log(`[Ready] Initializing for ${client.guilds.cache.size} server(s)...`);
        for (const [guildId, guild] of client.guilds.cache) {
            try {
                db.prepare('INSERT OR IGNORE INTO guilds (guild_id, name) VALUES (?, ?)').run(guildId, guild.name);
                const fetchedInvites = await guild.invites.fetch();
                const guildInvites = new Map();
                fetchedInvites.forEach(invite => guildInvites.set(invite.code, invite.uses));
                client.invites.set(guildId, guildInvites);
                await sendOrUpdateDashboard(client, guildId);
            } catch (error) {
                console.error(`[Ready] Failed to initialize for guild ${guild.name} (${guildId}):`, error);
            }
        }

        // Enhanced Startup DM
        try {
            const TARGET_GUILD_ID = '1336309776509960193';
            const guild = await client.guilds.fetch(TARGET_GUILD_ID).catch(() => null);

            const startupTime = (process.uptime()).toFixed(2);
            const apiLatency = `${client.ws.ping}ms`;
            const dbPingStart = Date.now();
            db.prepare('SELECT 1').run();
            const dbPing = `${Date.now() - dbPingStart}ms`;

            let totalUsers = 'N/A';
            let totalSolyx = 'N/A';
            if (guild) {
                totalUsers = guild.memberCount.toLocaleString();
                const solyxData = db.prepare('SELECT SUM(balance) as total FROM wallets WHERE guild_id = ?').get(TARGET_GUILD_ID);
                totalSolyx = (solyxData.total || 0).toLocaleString();
            }

            const startupEmbed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('Bot Online & Ready')
                .setFields(
                    { name: 'Status', value: 'Online', inline: true },
                    { name: 'Startup Time', value: `${startupTime}s`, inline: true },
                    { name: 'API Latency', value: apiLatency, inline: true },
                    { name: 'Database Ping', value: dbPing, inline: true },
                    { name: 'Commands Loaded', value: `${client.commands.size}`, inline: true },
                    { name: 'Total Users', value: totalUsers, inline: true },
                    { name: 'Total Solyx™', value: `<a:Yellow_Gem:1427764380489224295> ${totalSolyx}`, inline: true }
                )
                .setTimestamp();

            for (const ownerId of config.ownerIDs) {
                const owner = await client.users.fetch(ownerId).catch(() => null);
                if (owner) {
                    await owner.send({ embeds: [startupEmbed] }).catch(err => {
                        console.error(`Failed to DM owner ${ownerId}:`, err);
                    });
                }
            }
        } catch (error) {
            console.error(`[Ready] Failed to send enhanced startup DM:`, error);
        }

        // Set Bot Presence
        client.user.setPresence({
            activities: [{
                name: "Mythweaver Studios's Promise c:",
                type: ActivityType.Streaming,
                url: "https://youtu.be/qhvdg2D9d_o?si=olOBCuhgJ5CuGz-b"
            }],
            status: 'online',
        });
    },
};