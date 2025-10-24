// src/handlers/interactions/clan/mottoModalHandler.js
const clanManager = require('../../../managers/clanManager');

module.exports = async (interaction) => {
    // Corrected the ID check to match what's set in the dashboard handler
    if (!interaction.isModalSubmit() || interaction.customId !== 'dashboard_motto_modal') return;

    await interaction.deferReply({ flags: 64 });
    const motto = interaction.fields.getTextInputValue('motto_input') || null;
    const actingUserClan = clanManager.findClanContainingUser(interaction.guild.id, interaction.user.id);
    if (!actingUserClan) {
        return interaction.editReply({ content: "Could not find your clan to set the motto." });
    }
    
    const result = clanManager.setClanMotto(interaction.guild.id, actingUserClan.clanRoleId, motto);
    if (result.success) {
        await interaction.editReply({ content: motto ? `Your clan motto has been updated to: *“${motto}”*` : 'Your clan motto has been removed.' });
    } else {
        await interaction.editReply({ content: `Failed to set motto: ${result.message}` });
    }
};