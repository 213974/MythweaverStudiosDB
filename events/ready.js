// events/ready.js
const { Events, ActivityType } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9'); // Or v10 for d.js v14

async function registerCommands(client, appConfig) {
    const commands = [];
    client.commands.clear(); // Clear existing commands before reloading for /reload
    const commandFolders = fs.readdirSync(path.join(__dirname, '..', 'commands'));

    for (const folder of commandFolders) {
        const commandFiles = fs.readdirSync(path.join(__dirname, '..', 'commands', folder)).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.join(__dirname, '..', 'commands', folder, file);
            delete require.cache[require.resolve(filePath)]; // Crucial for reload
            const command = require(filePath);
            if (command.data && command.execute) {
                client.commands.set(command.data.name, command);
                commands.push(command.data.toJSON());
                // console.log(`[COMMAND LOADER in READY] Loaded command: /${command.data.name}`); // Less verbose
            } else {
                console.log(`[WARNING in READY] The command at ${filePath} is missing "data" or "execute".`);
            }
        }
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log('[READY_EVENT] Started refreshing application (/) commands.');
        if (!appConfig.guildID) {
            console.error('[READY_EVENT] guildID missing in config. Cannot register guild commands.');
            return;
        }
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, appConfig.guildID),
            { body: commands },
        );
        console.log('[READY_EVENT] Successfully reloaded application (/) commands for the guild.');
    } catch (error) {
        console.error('[READY_EVENT] Error refreshing guild commands:', error);
    }
}


module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(eventClient, handlerClient, appConfig) { // eventClient is client, handlerClient is also client
        const client = eventClient; // Use a consistent name
        console.log('[ready.js] Received config:', JSON.stringify(appConfig));
        console.log(`Ready! Logged in as ${client.user.tag}`);
        console.log(`Bot is in ${client.guilds.cache.size} servers.`);

        // Initialize client.commands if not already (should be done in index.js though)
        if (!client.commands) {
            const { Collection } = require('discord.js');
            client.commands = new Collection();
        }

        // Register/Reload slash commands
        await registerCommands(client, appConfig); // Pass client and appConfig

        if (appConfig && appConfig.ownerID) {
            try {
                const owner = await client.users.fetch(appConfig.ownerID);
                if (owner) {
                    await owner.send('Hello! I am online and ready to go! Commands have been refreshed.');
                    console.log(`Successfully DMed owner (${owner.tag}) that the bot is online.`);
                } else {
                    console.error(`Could not find user with ID: ${appConfig.ownerID}`);
                }
            } catch (error) {
                console.error(`Failed to DM owner (${appConfig.ownerID}):`, error);
            }
        } else {
            console.error('[ready.js] Error: appConfig.ownerID is undefined. Cannot DM owner.');
        }

        client.user.setPresence({
            activities: [{
                name: "Project PMU's Promise c:",
                type: ActivityType.Streaming,
                url: "https://youtu.be/qhvdg2D9d_o?si=olOBCuhgJ5CuGz-b"
            }],
            status: 'online',
        });
    },
    registerCommands, // Export for /reload command
};