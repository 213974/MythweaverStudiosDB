// src/commands/dev/reload.js
const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../../config');

// This function now also exactly matches the logic in deploy-commands.js.
function findCommandFiles(dir) {
    let commandFiles = [];
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        const filePath = path.join(dir, file.name);
        if (file.isDirectory()) {
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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reload')
        .setDescription('Reloads the logic of all commands.'),
    async execute(interaction) {
        if (!config.ownerIDs.includes(interaction.user.id)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: 64 });
        }

        await interaction.deferReply({ flags: 64 });

        try {
            console.log('[Reload] Clearing existing commands from client...');
            interaction.client.commands.clear();
            
            const commandsPath = path.join(__dirname, '..', '..', 'commands');
            const commandFiles = findCommandFiles(commandsPath);

            console.log(`[Reload] Found ${commandFiles.length} command files to reload.`);

            for (const file of commandFiles) {
                delete require.cache[require.resolve(file)];
                const command = require(file);

                if (command.data && command.execute) {
                    interaction.client.commands.set(command.data.name, command);
                } else {
                     console.warn(`[Reload] The command at ${file} is missing a required "data" or "execute" property.`);
                }
            }

            await interaction.editReply({ content: `✅ Successfully reloaded ${interaction.client.commands.size} commands.` });
        } catch (error) {
            console.error('Error during /reload command:', error);
            await interaction.editReply({ content: `❌ Failed to reload commands: ${error.message}` });
        }
    },
};