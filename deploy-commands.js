// deploy-commands.js
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');

// A recursive function to find all main command files
function findCommandFiles(dir) {
    let commandFiles = [];
    const files = fs.readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
        const filePath = path.join(dir, file.name);
        if (file.isDirectory()) {
            // If the directory is 'clan', we only want the main 'clan.js' file
            if (file.name === 'clan') {
                commandFiles.push(path.join(filePath, 'clan.js'));
            } else {
                 commandFiles = commandFiles.concat(findCommandFiles(filePath));
            }
        } else if (file.name.endsWith('.js')) {
            commandFiles.push(filePath);
        }
    }
    return commandFiles;
}

const commandFiles = findCommandFiles(commandsPath);

for (const file of commandFiles) {
    const command = require(file);
    if (command.data && command.execute) {
        commands.push(command.data.toJSON());
        console.log(`[+] Loaded: /${command.data.name}`);
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        if (!process.env.CLIENT_ID) throw new Error('CLIENT_ID is missing from .env');

        console.log(`Started refreshing ${commands.length} application (/) commands globally.`);

        // The route is now applicationCommands, NOT applicationGuildCommands
        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands globally.`);
    } catch (error) {
        console.error(error);
    }
})();