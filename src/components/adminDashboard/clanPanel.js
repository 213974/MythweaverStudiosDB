// src/components/adminDashboard/clanPanel.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function createClanDashboard() {
    const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle('🛡️ Clan Management 🛡️')
        .setDescription('Use the buttons below to perform administrative actions on server clans.');

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('admin_clan_create')
            .setLabel('Create Clan')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('admin_clan_delete')
            .setLabel('Delete Clan')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('admin_clan_owner')
            .setLabel('Change Owner')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('admin_panel_back')
            .setLabel('Back to Main')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row] };
}

module.exports = { createClanDashboard };