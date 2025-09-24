// deploy-commands.js
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const config = require('./src/config');

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');

// This function correctly finds all main command files
function findCommandFiles(dir) {
    let commandFiles = [];
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        const filePath = path.join(dir, file.name);
        if (file.isDirectory()) {
            if (file.name === 'clan') commandFiles.push(path.join(filePath, 'clan.js'));
            else commandFiles = commandFiles.concat(findCommandFiles(filePath));
        } else if (file.name.endsWith('.js')) {
            commandFiles.push(filePath);
        }
    }
    return commandFiles;
}

const commandFiles = findCommandFiles(commandsPath);
for (const file of commandFiles) {
    const command = require(file);
    if (command.data && command.execute) commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        if (!process.env.CLIENT_ID) throw new Error('CLIENT_ID is missing from .env');
        if (!config.guildIDs || config.guildIDs.length === 0) throw new Error('guildIDs array is missing or empty in src/config.js');

        console.log(`Started refreshing ${commands.length} application (/) commands for ${config.guildIDs.length} server(s).`);

        // Loop through each guild ID from the config and deploy commands
        for (const guildId of config.guildIDs) {
            try {
                const data = await rest.put(
                    Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
                    { body: commands },
                );
                console.log(`[SUCCESS] Successfully reloaded ${data.length} commands for server ${guildId}.`);
            } catch (err) {
                console.error(`[FAILED] Could not deploy commands to server ${guildId}:`, err);
            }
        }
    } catch (error) {
        console.error(error);
    }
})();