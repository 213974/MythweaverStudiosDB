// handlers/commandHandler.js
const fs = require('node:fs');
const path = require('node:path');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9'); // Ensure this matches your discord.js version, v10 for d.js v14

module.exports = (client, config) => {
    client.commands = new Map(); // Use Map for easier access
    const commands = [];
    const commandFolders = fs.readdirSync(path.join(__dirname, '..', 'commands'));

    for (const folder of commandFolders) {
        const commandFiles = fs.readdirSync(path.join(__dirname, '..', 'commands', folder)).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.join(__dirname, '..', 'commands', folder, file);
            const command = require(filePath);
            if (command.data && command.execute) {
                client.commands.set(command.data.name, command);
                commands.push(command.data.toJSON());
                console.log(`[COMMAND HANDLER] Loaded command: /${command.data.name}`);
            } else {
                console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
            }
        }
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN); // Use '10' for d.js v14

    (async () => {
        try {
            console.log('[COMMAND HANDLER] Started refreshing application (/) commands.');

            if (!config.guildID) {
                console.error('[COMMAND HANDLER] guildID is not set in config.js. Cannot register guild commands.');
                return;
            }
            if (!client.user || !client.user.id) {
                console.error('[COMMAND HANDLER] Client user or client user ID is not available. Ensure bot is logged in before command registration or call this after ready event.');
                // This part often runs on ready event to ensure client.user.id is available
                // For now, let's assume it might be called later or client.user.id is somehow available.
                // A common pattern is to register commands in the 'ready' event.
                return;
            }


            await rest.put(
                Routes.applicationGuildCommands(client.user.id, config.guildID),
                { body: commands },
            );

            console.log('[COMMAND HANDLER] Successfully reloaded application (/) commands for the guild.');
        } catch (error) {
            console.error('[COMMAND HANDLER] Error refreshing application commands:', error);
        }
    })();
};