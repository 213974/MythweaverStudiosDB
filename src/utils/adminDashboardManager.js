// utils/adminDashboardManager.js
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('./database');

function createAdminDashboardEmbed() {
    return new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('👑 Administrator Dashboard 👑')
        .setDescription(
            "Welcome, Administrator.\n\n" +
            "This is the central control panel for bot and server management. Select a system from the dropdown menu to manage it."
        )
        .setFooter({ text: 'Mythweaver Studios | Administrative Panel' });
}

function createAdminDashboardComponents() {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('admin_dashboard_menu')
        .setPlaceholder('Select a system to manage...')
        .addOptions([
            {
                label: 'Manage Economy',
                description: 'Add, remove, or set currency for a user.',
                value: 'admin_dash_economy',
                emoji: '🪙',
            },
            {
                label: 'Manage Role Shop',
                description: 'Add, remove, or update items in the role shop.',
                value: 'admin_dash_shop',
                emoji: '🛍️',
            },
        ]);

    return new ActionRowBuilder().addComponents(selectMenu);
}

async function sendOrUpdateAdminDashboard(client) {
    const channelId = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_dashboard_channel_id')?.value;
    let messageId = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_dashboard_message_id')?.value;

    if (!channelId) {
        return;
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
        console.error('[AdminDashboard] Could not fetch the admin dashboard channel. It may have been deleted.');
        return;
    }

    const embed = createAdminDashboardEmbed();
    const components = createAdminDashboardComponents();

    try {
        if (messageId) {
            const message = await channel.messages.fetch(messageId).catch(() => null);
            if (message) {
                await message.edit({ embeds: [embed], components: [components] });
                console.log('[AdminDashboard] Successfully refreshed the admin dashboard.');
                return;
            }
        }

        const newMessage = await channel.send({ embeds: [embed], components: [components] });
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
            .run('admin_dashboard_message_id', newMessage.id);
        console.log('[AdminDashboard] Sent a new admin dashboard and saved its ID.');

    } catch (error) {
        console.error('[AdminDashboard] Failed to send or update dashboard:', error);
    }
}

module.exports = {
    sendOrUpdateAdminDashboard,
    createAdminDashboardEmbed,
    createAdminDashboardComponents,
};