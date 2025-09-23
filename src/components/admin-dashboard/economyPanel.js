// src/components/admin-dashboard/economyPanel.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function createEconomyDashboard() {
    const embed = new EmbedBuilder()
        .setColor('#F1C40F')
        .setTitle('🪙 Economy Management 🪙')
        .setDescription('Select an action to perform on a user\'s Solyx™ balance.');

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('admin_eco_give')
            .setLabel('Give Solyx')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('admin_eco_remove')
            .setLabel('Remove Solyx')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('admin_eco_set')
            .setLabel('Set Solyx')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('admin_panel_back')
            .setLabel('Back to Main')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row] };
}

module.exports = { createEconomyDashboard };