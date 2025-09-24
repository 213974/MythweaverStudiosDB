// clear-guild-commands.js
require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const config = require('./src/config');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        if (!process.env.CLIENT_ID) throw new Error('CLIENT_ID is missing from .env');
        if (!config.guildID) throw new Error('guildID is missing from src/config.js to clear');

        console.log(`Clearing old application (/) commands from guild: ${config.guildID}`);

        // The body is an empty array to delete all commands.
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, config.guildID),
            { body: [] },
        );

        console.log('Successfully cleared old guild-specific commands.');
    } catch (error) {
        console.error('Failed to clear guild commands:', error);
    }
})();