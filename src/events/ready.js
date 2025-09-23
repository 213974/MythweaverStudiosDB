// events/ready.js
const { Events, ActivityType, Collection } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { sendOrUpdateDashboard } = require('../utils/dashboardManager');
const { sendOrUpdateAdminDashboard } = require('../utils/adminDashboardManager');
const { getLatestChapterInfo } = require('../utils/manhwaTracker');

function loadCommands(client) {
    client.commands = new Collection();
    const commandFoldersPath = path.join(__dirname, '..', 'commands');
    const commandFolders = fs.readdirSync(commandFoldersPath);

    for (const folder of commandFolders) {
        const folderPath = path.join(commandFoldersPath, folder);
        const stats = fs.lstatSync(folderPath);
        if (stats.isDirectory()) {
            const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                const filePath = path.join(folderPath, file);
                delete require.cache[require.resolve(filePath)];
                const command = require(filePath);
                if (command.data && command.execute) {
                    client.commands.set(command.data.name, command);
                }
            }
        } else if (folder.endsWith('.js')) {
            const filePath = path.join(commandFoldersPath, folder);
            delete require.cache[require.resolve(filePath)];
            const command = require(filePath);
            if (command.data && command.execute) {
                client.commands.set(command.data.name, command);
            }
        }
    }
}

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client, handlerClient, appConfig) {
        console.log(`Ready! Logged in as ${client.user.tag}`);
        console.log(`Bot is in ${client.guilds.cache.size} servers.`);

        loadCommands(client);

        await sendOrUpdateDashboard(client);
        await sendOrUpdateAdminDashboard(client);

        // Initialize Invite Cache for Referral System
        try {
            if (appConfig.guildID) {
                const guild = await client.guilds.fetch(appConfig.guildID);
                const fetchedInvites = await guild.invites.fetch();
                
                const invites = new Map();
                fetchedInvites.forEach(invite => {
                    invites.set(invite.code, invite.uses);
                });
                
                if(!client.invites) client.invites = new Map();
                client.invites.set(guild.id, invites);

                console.log(`[Ready] Successfully cached ${invites.size} invites for referral tracking in guild ${guild.name}.`);
            }
        } catch (error) {
            console.error(`[Ready] Failed to initialize invite cache:`, error);
        }

        if (appConfig && appConfig.ownerID) {
            try {
                const chapterInfo = await getLatestChapterInfo();
                let startupMessage = 'Hello! I am online and ready to go!';
                if (chapterInfo.error) {
                    startupMessage += `\n\nI tried to check for the latest 'Pick Me Up' chapter, but an error occurred: ${chapterInfo.error}`;
                } else {
                    startupMessage += `\n\nThe latest English chapter of *Pick Me Up: Infinite Gacha* appears to be **Chapter ${chapterInfo.chapter}**.`;
                    startupMessage += `\nYou can read it at:\n• Asura Comic: <${chapterInfo.link1}>\n• ComicK: <${chapterInfo.link2}>`;
                }
                const owner = await client.users.fetch(appConfig.ownerID);
                if (owner) await owner.send(startupMessage);
            } catch (error) {
                console.error(`Failed to DM owner (${appConfig.ownerID}):`, error);
            }
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