// src/commands/dev/reload.js
const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../../config');

// --- Helper Functions ---

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

function findServiceFiles(dir) {
    let serviceFiles = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            serviceFiles = serviceFiles.concat(findServiceFiles(fullPath));
        } else if (item.name.endsWith('.js')) {
            serviceFiles.push(fullPath);
        }
    }
    return serviceFiles;
}

// --- Command Definition ---

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reload')
        .setDescription('Reloads parts of the bot\'s code without a full restart.')
        .addSubcommand(sub =>
            sub.setName('commands')
            .setDescription('Reloads all slash command files.')
        )
        .addSubcommand(sub =>
            sub.setName('services')
            .setDescription('Reloads all service files (e.g., image generator).')
        ),
    async execute(interaction) {
        if (!config.ownerIDs.includes(interaction.user.id)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: 64 });
        }

        await interaction.deferReply({ flags: 64 });
        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'commands') {
                interaction.client.commands.clear();
                const commandsPath = path.join(__dirname, '..', '..', 'commands');
                const commandFiles = findCommandFiles(commandsPath);
                let count = 0;
                for (const file of commandFiles) {
                    delete require.cache[require.resolve(file)];
                    const command = require(file);
                    if (command.data && command.execute) {
                        interaction.client.commands.set(command.data.name, command);
                        count++;
                    }
                }
                await interaction.editReply({ content: `✅ Successfully reloaded **${count}** commands.` });
            } else if (subcommand === 'services') {
                const servicesPath = path.join(__dirname, '..', '..', '..', 'services');
                const serviceFiles = findServiceFiles(servicesPath);
                let count = 0;
                for (const file of serviceFiles) {
                    delete require.cache[require.resolve(file)];
                    count++;
                }
                await interaction.editReply({ content: `✅ Successfully reloaded **${count}** services.` });
            }
        } catch (error) {
            console.error(`Error during /reload ${subcommand}:`, error);
            await interaction.editReply({ content: `❌ Failed to reload ${subcommand}: ${error.message}` });
        }
    },
};