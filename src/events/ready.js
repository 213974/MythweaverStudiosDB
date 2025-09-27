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

        // Multi-Guild Initialization
        console.log(`[Ready] Initializing for ${client.guilds.cache.size} server(s)...`);
        for (const [guildId, guild] of client.guilds.cache) {
            try {
                db.prepare('INSERT OR IGNORE INTO guilds (guild_id, name) VALUES (?, ?)').run(guildId, guild.name);
                const fetchedInvites = await guild.invites.fetch();
                const guildInvites = new Map();
                fetchedInvites.forEach(invite => guildInvites.set(invite.code, invite.uses));
                client.invites.set(guildId, guildInvites);
console.log(`[Ready] Cached ${guildInvites.size} invites for guild: ${guild.name}`);
                await sendOrUpdateDashboard(client, guildId);
            } catch (error) {
                console.error(`[Ready] Failed to initialize for guild ${guild.name} (${guildId}):`, error);
            }
        }

        // --- Enhanced Startup DM ---
        try {
            const TARGET_GUILD_ID = '1336309776509960193';
            const guild = await client.guilds.fetch(TARGET_GUILD_ID).catch(() => null);

            // 1. Gather Bot & System Metrics
            const startupTime = (process.uptime()).toFixed(2);
            const apiLatency = `${client.ws.ping}ms`;
            const dbPingStart = Date.now();
            db.prepare('SELECT 1').run();
            const dbPing = `${Date.now() - dbPingStart}ms`;

            // 2. Gather Guild-Specific Metrics
            let totalUsers = 'N/A';
            let totalSolyx = 'N/A';
            if (guild) {
                totalUsers = guild.memberCount.toLocaleString();
                const solyxData = db.prepare('SELECT SUM(balance) as total FROM wallets WHERE guild_id = ?').get(TARGET_GUILD_ID);
                totalSolyx = (solyxData.total || 0).toLocaleString();
            }

            // 3. Build the Embed with the hardcoded reason
            const startupEmbed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('Bot Online & Ready')
                .setDescription(`Restart Reason: *Maintenance & Improvements*`)
                .setFields(
                    { name: 'Status', value: 'Online', inline: true },
                    { name: 'Startup Time', value: `${startupTime}s`, inline: true },
                    { name: 'API Latency', value: apiLatency, inline: true },
                    { name: 'Database Ping', value: dbPing, inline: true },
                    { name: 'Commands Loaded', value: `${client.commands.size}`, inline: true },
                    { name: 'Total Users', value: totalUsers, inline: true },
                    { name: 'Total Solyx™', value: `🪙 ${totalSolyx}`, inline: true }
                )
                .setTimestamp();

            // 4. Send DM to all owners
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