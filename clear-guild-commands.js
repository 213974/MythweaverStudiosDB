// clear-global-commands.js
require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        if (!process.env.CLIENT_ID) throw new Error('CLIENT_ID is missing from .env');
        console.log('Attempting to clear all global application (/) commands.');
        // Pass an empty array to the global applicationCommands route to clear them.
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: [] },
        );
        console.log('Successfully cleared all global commands.');
    } catch (error) {
        console.error('Failed to clear global commands:', error);
    }
})();