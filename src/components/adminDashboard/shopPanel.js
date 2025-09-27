// src/components/adminDashboard/shopPanel.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function createShopDashboard() {
    const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('🛍️ Shop Management 🛍️')
        .setDescription('Add, remove, or update the price of roles available for purchase in the shop.');

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('admin_shop_add')
            .setLabel('Add Item')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('admin_shop_remove')
            .setLabel('Remove Item')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('admin_shop_update')
            .setLabel('Update Price')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('admin_panel_back')
            .setLabel('Back to Main')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row] };
}

module.exports = { createShopDashboard };