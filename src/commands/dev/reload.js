// src/commands/dev/reload.js
const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../../config');

// --- Helper Functions ---

/**
 * Recursively finds all .js files in a directory.
 * @param {string} dir The directory to search.
 * @returns {string[]} An array of full file paths.
 */
function findJsFiles(dir) {
    let filesFound = [];
    if (!fs.existsSync(dir)) return []; // Guard against non-existent directories
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            filesFound = filesFound.concat(findJsFiles(fullPath));
        } else if (item.name.endsWith('.js')) {
            filesFound.push(fullPath);
        }
    }
    return filesFound;
}

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
            .setDescription('Reloads services, managers, and events to apply deep changes.')
        )
        .addSubcommand(sub =>
            sub.setName('events')
            .setDescription('Reloads all event handler files.')
        ),
    async execute(interaction) {
        if (!config.ownerIDs.includes(interaction.user.id)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: 64 });
        }

        await interaction.deferReply({ flags: 64 });
        const subcommand = interaction.options.getSubcommand();
        let replyMessage = '';

        try {
            if (subcommand === 'commands') {
                let reloadedCount = 0;
                interaction.client.commands.clear();
                const commandsPath = path.join(__dirname, '..', '..', 'commands');
                const commandFiles = findCommandFiles(commandsPath);
                for (const file of commandFiles) {
                    delete require.cache[require.resolve(file)];
                    const command = require(file);
                    if (command.data && command.execute) {
                        interaction.client.commands.set(command.data.name, command);
                        reloadedCount++;
                    }
                }
                replyMessage = `✅ Successfully reloaded **${reloadedCount}** commands.`;

            } else if (subcommand === 'events' || subcommand === 'services') {
                // Shared logic for reloading events, as services depend on them.
                const eventsPath = path.join(__dirname, '..', '..', 'events');
                const eventFiles = findJsFiles(eventsPath);
                let reloadedEventCount = 0;

                for (const file of eventFiles) {
                    const event = require(file); // require before deleting to get event name
                    interaction.client.removeAllListeners(event.name);
                    delete require.cache[require.resolve(file)];
                    reloadedEventCount++;
                }
                
                // Re-register all events by re-running the handler loader
                require('../../handlers/eventHandler')(interaction.client, config);
                
                if (subcommand === 'services') {
                    // Full-stack reload for services
                    const servicesPath = path.join(__dirname, '..', '..', '..', 'services');
                    const managersPath = path.join(__dirname, '..', '..', 'managers');
                    
                    const serviceFiles = findJsFiles(servicesPath);
                    for (const file of serviceFiles) {
                        delete require.cache[require.resolve(file)];
                    }

                    const managerFiles = findJsFiles(managersPath);
                    for (const file of managerFiles) {
                        delete require.cache[require.resolve(file)];
                    }
                    
                    replyMessage = `✅ **Full Stack Reload:** Reloaded **${serviceFiles.length}** services, **${managerFiles.length}** managers, and **${reloadedEventCount}** events.`;
                } else {
                    // Just reloading events
                    replyMessage = `✅ Successfully reloaded **${reloadedEventCount}** events.`;
                }
            }

            await interaction.editReply({ content: replyMessage });

        } catch (error) {
            console.error(`Error during /reload ${subcommand}:`, error);
            await interaction.editReply({ content: `❌ Failed to reload ${subcommand}: ${error.message}` });
        }
    },
};