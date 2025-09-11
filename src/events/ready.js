// events/ready.js
const { Events, ActivityType, Collection } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { sendOrUpdateDashboard } = require('../utils/dashboardManager');
const { sendOrUpdateAdminDashboard } = require('../utils/adminDashboardManager');
const { getLatestChapterInfo } = require('../utils/manhwaTracker');

function loadCommands(client) {
    client.commands = new Collection();
    const commandFolders = fs.readdirSync(path.join(__dirname, '..', 'commands'));

    for (const folder of commandFolders) {
        const commandFiles = fs.readdirSync(path.join(__dirname, '..', 'commands', folder)).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.join(__dirname, '..', 'commands', folder, file);
            delete require.cache[require.resolve(filePath)];
            const command = require(filePath);
            if (command.data && command.execute) {
                client.commands.set(command.data.name, command);
            } else {
                console.log(`[WARNING] The command at ${filePath} is missing "data" or "execute".`);
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

        if (appConfig && appConfig.ownerID) {
            try {
                console.log('[Startup] Fetching latest manhwa chapter info...');
                const chapterInfo = await getLatestChapterInfo();
                
                let startupMessage = 'Hello! I am online and ready to go!';
                
                if (chapterInfo.error) {
                    startupMessage += `\n\nI tried to check for the latest 'Pick Me Up' chapter, but an error occurred: ${chapterInfo.error}`;
                } else {
                    startupMessage += `\n\nThe latest English chapter of *Pick Me Up: Infinite Gacha* appears to be **Chapter ${chapterInfo.chapter}**.`;
                    startupMessage += `\n\nYou can read it at:\n• Asura Comic: <${chapterInfo.link1}>\n• ComicK: <${chapterInfo.link2}>`;
                }

                const owner = await client.users.fetch(appConfig.ownerID);
                if (owner) {
                    await owner.send(startupMessage);
                    console.log(`Successfully DMed owner (${owner.tag}) with the startup message.`);
                }
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