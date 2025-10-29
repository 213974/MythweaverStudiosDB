// src/events/ready.js
const { Events, ActivityType, Collection, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { sendOrUpdateDashboard } = require('../managers/dashboardManager');
const db = require('../utils/database');
const config = require('../config');
const dropManager = require('../managers/dropManager');

function loadCommands(client) {
    client.commands = new Collection();
    const commandsPath = path.join(__dirname, '..', 'commands');

    function findCommandFiles(dir) {
        let commandFiles = [];
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
            const filePath = path.join(dir, file.name);
            if (file.isDirectory()) {
                if (file.name === 'clan') {
                    commandFiles.push(path.join(filePath, 'clan.js'));
                } else {
                    commandFiles = commandFiles.concat(findCommandFiles(filePath));
                }
            } else if (file.name.endsWith('.js')) {
                commandFiles.push(filePath);
            }
        }
        return commandFiles;
    }

    const commandFiles = findCommandFiles(commandsPath);
    for (const file of commandFiles) {
        delete require.cache[require.resolve(file)];
        const command = require(file);
        // Only load main command files into the client's collection.
        if (command.data && command.execute) {
            client.commands.set(command.data.name, command);
        }
    }
    console.log(`[Ready] Successfully loaded ${client.commands.size} command(s).`);
}

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);
        
        loadCommands(client);
        client.invites = new Map();

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

        // Cleanup any drops that were active during a crash
        await dropManager.cleanupOrphanedDrops(client);

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
                .setDescription('*Hourly Solyx Drop Testing*')
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