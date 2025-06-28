// deploy-commands.js
require('dotenv').config();
const fs = require('node:fs'); // Corrected typo here
const path = require('node:path');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const config = require('./src/config');
const { Client } = require('discord.js');

// A temporary client to get the application ID
const client = new Client({ intents: [] });

const commands = [];
const commandFolders = fs.readdirSync(path.join(__dirname, 'commands'));

console.log('Loading command files...');

for (const folder of commandFolders) {
    const commandFiles = fs.readdirSync(path.join(__dirname, 'commands', folder)).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(__dirname, 'commands', folder, file);
        const command = require(filePath);
        if (command.data && command.execute) {
            commands.push(command.data.toJSON());
            console.log(`[+] Loaded: /${command.data.name}`);
        } else {
            console.log(`[!] Warning: The command at ${filePath} is missing "data" or "execute".`);
        }
    }
}

if (!process.env.DISCORD_TOKEN) {
    console.error('Error: DISCORD_TOKEN is not defined in your .env file!');
    process.exit(1);
}
if (!config.guildID) {
    console.error('Error: guildID is missing from src/config.js');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Logging in to fetch Application ID...');
        await client.login(process.env.DISCORD_TOKEN);
        const applicationId = client.user.id;
        client.destroy();
        console.log(`Application ID fetched: ${applicationId}`);

        console.log('Started refreshing application (/) commands.');

        await rest.put(
            // Use the fetched Application ID here
            Routes.applicationGuildCommands(applicationId, config.guildID),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands for the guild.');
    } catch (error) {
        console.error('Error refreshing application commands:', error);
    }
})();