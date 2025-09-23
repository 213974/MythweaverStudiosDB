// src/components/admin-dashboard/rafflePanel.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function createRaffleDashboard() {
    const embed = new EmbedBuilder()
        .setColor('#1ABC9C')
        .setTitle('🎟️ Raffle Management 🎟️')
        .setDescription('Create new raffles, view active ones, or draw winners for ended ones.');

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('admin_raffle_create')
            .setLabel('Create Raffle')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('admin_raffle_end')
            .setLabel('End Raffle Early')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('admin_raffle_view')
            .setLabel('View Active Raffles')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('admin_panel_back')
            .setLabel('Back to Main')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row] };
}

module.exports = { createRaffleDashboard };