// commands/admin/reload.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../src/config');
// We need access to the registerCommands function from ready.js
// This is a bit tricky as ready.js executes. We might need to expose it differently or re-implement.
// For simplicity, we'll re-implement the core logic here or call it if exposed by client.

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reload')
        .setDescription('Reloads all slash commands for the bot.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Or specific owner check
    async execute(interaction) {
        if (interaction.user.id !== config.ownerID) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: 64 });
        }

        await interaction.deferReply({ flags: 64 });

        try {
            // The command registration logic is in ready.js.
            // We need a way to call it. Let's assume it's attached to client for this example.
            // This requires modification in ready.js to attach `registerCommands` to the client.
            const readyEventHandler = require('../../events/ready.js');
            if (typeof readyEventHandler.registerCommands === 'function') {
                await readyEventHandler.registerCommands(interaction.client, config);
                // Also, re-load event handlers if needed (though typically not required for command reloads unless events themselves changed)
                delete require.cache[require.resolve('../../handlers/eventHandler.js')];
                const loadEvents = require('../../handlers/eventHandler.js');
                loadEvents(interaction.client, config); // Re-attach event listeners

                await interaction.editReply({ content: 'Successfully reloaded all slash commands and re-attached events.' });
            } else {
                throw new Error("registerCommands function not found on ready.js module.");
            }
        } catch (error) {
            console.error('Error during /reload command:', error);
            await interaction.editReply({ content: `Failed to reload commands: ${error.message}` });
        }
    },
};