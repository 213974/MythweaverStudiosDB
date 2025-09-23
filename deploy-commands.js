// deploy-commands.js
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const config = require('./src/config');

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');

function findCommandFiles(dir) {
    let commandFiles = [];
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        const filePath = path.join(dir, file.name);
        if (file.isDirectory()) {
            commandFiles = commandFiles.concat(findCommandFiles(filePath));
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
    } else {
        console.log(`[!] Warning: The command at ${file} is missing "data" or "execute".`);
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        if (!process.env.CLIENT_ID) throw new Error('CLIENT_ID is not defined in your .env file!');
        if (!config.guildID) throw new Error('guildID is missing from src/config.js');

        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, config.guildID),
            { body: commands },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
})();