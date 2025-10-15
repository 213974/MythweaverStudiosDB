// src/handlers/interactions/helpInteractionHandler.js
const { createClanHelpEmbed } = require('../../components/help/clanHelp');
const { createUtilitiesHelpEmbed } = require('../../components/help/utilitiesHelp');
const { createSolyxHelpEmbed } = require('../../components/help/solyxHelp');

module.exports = async (interaction) => {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'help_category_select') return;
    
    await interaction.deferReply({ flags: 64 });
    const selection = interaction.values[0];

    let embed;
    switch (selection) {
        case 'help_clan':
            embed = createClanHelpEmbed();
            break;
        case 'help_utilities':
            embed = createUtilitiesHelpEmbed();
            break;
        case 'help_solyx':
            embed = createSolyxHelpEmbed();
            break;
        default:
            return interaction.editReply({ content: 'Invalid selection.' });
    }

    await interaction.editReply({ embeds: [embed] });
};