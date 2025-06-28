// events/ready.js
const { Events, ActivityType, Collection } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { sendOrUpdateDashboard } = require('../utils/dashboardManager');
const { sendOrUpdateAdminDashboard } = require('../utils/adminDashboardManager');

// This function now only loads commands into the client, it doesn't register them.
function loadCommands(client) {
    client.commands = new Collection();
    const commandFolders = fs.readdirSync(path.join(__dirname, '..', 'commands'));

    for (const folder of commandFolders) {
        const commandFiles = fs.readdirSync(path.join(__dirname, '..', 'commands', folder)).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.join(__dirname, '..', 'commands', folder, file);
            delete require.cache[require.resolve(filePath)]; // Good for hot-reloading
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

        loadCommands(client); // Load commands into the client collection

        // Initialize Dashboards
        await sendOrUpdateDashboard(client);
        await sendOrUpdateAdminDashboard(client);

        if (appConfig && appConfig.ownerID) {
            try {
                const owner = await client.users.fetch(appConfig.ownerID);
                if (owner) {
                    await owner.send('Hello! I am online and ready to go!');
                    console.log(`Successfully DMed owner (${owner.tag}) that the bot is online.`);
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