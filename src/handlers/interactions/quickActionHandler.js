// src/handlers/interactions/quickActionHandler.js

module.exports = async (interaction) => {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'quick_action_select') return;
    
    const selection = interaction.values[0];
    let commandName;

    switch (selection) {
        case 'qa_daily':
            commandName = 'daily';
            break;
        case 'qa_weekly':
            commandName = 'weekly';
            break;
        default:
            return interaction.reply({ content: 'Invalid selection.', flags: 64 });
    }

    const command = interaction.client.commands.get(commandName);
    if (!command) {
        return interaction.reply({ content: `Error: Could not find the \`/${commandName}\` command.`, flags: 64 });
    }

    try {
        // We no longer defer or update the original interaction.
        // We pass the raw, unacknowledged interaction from the dropdown menu
        // directly to the command file. The command file itself will then be
        // responsible for the one and only reply. This is a much cleaner flow.
        await command.execute(interaction);
    } catch (error) {
        console.error(`[QuickActionHandler] Error executing /${commandName}:`, error);
        // If the command execution fails, we might still need to respond to the interaction.
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: `An error occurred while running the \`/${commandName}\` command.`, flags: 64 });
        } else {
            await interaction.followUp({ content: `An error occurred while running the \`/${commandName}\` command.`, flags: 64 });
        }
    }
};