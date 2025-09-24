// src/events/ready.js
const { Events, ActivityType, Collection } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { sendOrUpdateDashboard } = require('../utils/dashboardManager');
const db = require('../utils/database');
const { getLatestChapterInfo } = require('../utils/manhwaTracker');

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
    async execute(client, handlerClient, appConfig) {
        console.log(`Ready! Logged in as ${client.user.tag}`);
        
        loadCommands(client);
        client.invites = new Map();

        // Multi-Guild Initialization
        console.log(`[Ready] Initializing for ${client.guilds.cache.size} server(s)...`);
        for (const [guildId, guild] of client.guilds.cache) {
            try {
                // 1. Register guild in the database
                db.prepare('INSERT OR IGNORE INTO guilds (guild_id, name) VALUES (?, ?)').run(guildId, guild.name);

                // 2. Cache invites for each guild
                const fetchedInvites = await guild.invites.fetch();
                const guildInvites = new Map();
                fetchedInvites.forEach(invite => guildInvites.set(invite.code, invite.uses));
                client.invites.set(guildId, guildInvites);
                console.log(`[Ready] Cached ${guildInvites.size} invites for guild: ${guild.name}`);
                
                // 3. Update persistent dashboards for each guild
                await sendOrUpdateDashboard(client, guildId);
            } catch (error) {
                console.error(`[Ready] Failed to initialize for guild ${guild.name} (${guildId}):`, error);
            }
        }

        // DM Owner with startup info
        if (appConfig && appConfig.ownerID) {
            try {
                const chapterInfo = await getLatestChapterInfo();
                let startupMessage = 'Hello! I am online and ready to go!';
                if (!chapterInfo.error) {
                    startupMessage += `\n\nThe latest English chapter of *Pick Me Up: Infinite Gacha* appears to be **Chapter ${chapterInfo.chapter}**.`;
                }
                const owner = await client.users.fetch(appConfig.ownerID);
                if (owner) await owner.send(startupMessage);
            } catch (error) {
                console.error(`Failed to DM owner (${appConfig.ownerID}):`, error);
            }
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