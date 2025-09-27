// src/components/adminDashboard/mainPanel.js
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

function createMainDashboard() {
    const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('👑 Administrator Dashboard 👑')
        .setDescription(
            "Welcome, Administrator.\n\n" +
            "This is the central control panel for bot and server management. Select a system from the dropdown menu to manage it."
        )
        .setFooter({ text: 'Paved by the Fallen | Administrative Panel' });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('admin_panel_select')
        .setPlaceholder('Select a system to manage...')
        .addOptions([
            {
                label: 'Manage Economy',
                description: 'Adjust user Solyx™ balances.',
                value: 'admin_panel_economy',
                emoji: '🪙',
            },
            {
                label: 'Manage Clans',
                description: 'Create, delete, or transfer ownership of clans.',
                value: 'admin_panel_clans',
                emoji: '🛡️',
            },
            {
                label: 'Manage Shop',
                description: 'Add, remove, or update items in the role shop.',
                value: 'admin_panel_shop',
                emoji: '🛍️',
            },
            {
                label: 'Manage Raffles',
                description: 'Create and manage server raffles.',
                value: 'admin_panel_raffles',
                emoji: '🎟️',
            },
        ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    return { embeds: [embed], components: [row] };
}

module.exports = { createMainDashboard, createAdminDashboardComponents: createMainDashboard }; // Alias for compatibility with ready.js