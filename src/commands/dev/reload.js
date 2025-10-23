// commands/admin/reload.js
const { SlashCommandBuilder, Collection } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../../config');

// Re-implement the simplified command loader here
function loadCommands(client) {
    client.commands.clear();
    const commandFolders = fs.readdirSync(path.join(__dirname, '..', '..', 'commands'));
    for (const folder of commandFolders) {
        const commandFiles = fs.readdirSync(path.join(__dirname, '..', '..', 'commands', folder)).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.join(__dirname, '..', '..', 'commands', folder, file);
            delete require.cache[require.resolve(filePath)];
            const command = require(filePath);
            if (command.data && command.execute) {
                client.commands.set(command.data.name, command);
            }
        }
    }
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
            loadCommands(interaction.client);
            await interaction.editReply({ content: 'Successfully reloaded all command logic.' });
        } catch (error) {
            console.error('Error during /reload command:', error);
            await interaction.editReply({ content: `Failed to reload commands: ${error.message}` });
        }
    },
};