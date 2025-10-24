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
        case 'qa_profile':
            commandName = 'profile';
            break;
        default:
            return interaction.reply({ content: 'Invalid selection.', flags: 64 });
    }

    const command = interaction.client.commands.get(commandName);
    if (!command) {
        return interaction.reply({ content: `Error: Could not find the \`/${commandName}\` command.`, flags: 64 });
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`[QuickActionHandler] Error executing /${commandName}:`, error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: `An error occurred while running the \`/${commandName}\` command.`, flags: 64 });
        } else {
            await interaction.followUp({ content: `An error occurred while running the \`/${commandName}\` command.`, flags: 64 });
        }
    }
};