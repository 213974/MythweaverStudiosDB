// deploy-commands.js
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const config = require('./src/config');

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');

// Reverting to the original, proven file discovery logic.
function findCommandFiles(dir) {
    let commandFiles = [];
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        const filePath = path.join(dir, file.name);
        if (file.isDirectory()) {
            // Special handling for the 'clan' command group directory.
            if (file.name === 'clan') {
                commandFiles.push(path.join(filePath, 'clan.js'));
            } else {
                // For other directories, recurse into them.
                commandFiles = commandFiles.concat(findCommandFiles(filePath));
            }
        } else if (file.name.endsWith('.js')) {
            // Add top-level command files.
            commandFiles.push(filePath);
        }
    }
    return commandFiles;
}

const commandFiles = findCommandFiles(commandsPath);

for (const file of commandFiles) {
    // We only load files that have a `data` property, which subcommand modules lack.
    // This prevents the "missing property" warning for clan subcommands.
    const command = require(file);
    if (command.data && command.execute) {
        commands.push(command.data.toJSON());
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        if (!process.env.CLIENT_ID) throw new Error('CLIENT_ID is missing from .env');
        if (!config.guildIDs || config.guildIDs.length === 0) throw new Error('guildIDs array is missing or empty in src/config.js');

        console.log(`Started refreshing ${commands.length} application (/) commands for ${config.guildIDs.length} server(s).`);

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