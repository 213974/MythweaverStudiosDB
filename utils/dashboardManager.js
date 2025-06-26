// utils/dashboardManager.js
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('./database');

function createDashboardEmbed() {
    return new EmbedBuilder()
        .setColor('#D3A0F5')
        .setTitle('⚔️ Clan Receptionist Dashboard ⚔️')
        .setDescription(
            "Welcome to the Clan Hall.\n\n" +
            "This is the central dashboard for all clan operations. Whether you are a seasoned leader or a new recruit, your journey begins here. Please select an action from the dropdown menu below.\n\n" +
            "*Note: Certain actions require appropriate clan permissions to use.*"
        )
        .setFooter({ text: 'Mythweaver Studios | Clan Operations' });
}

function createDashboardComponents() {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('clan_dashboard_menu')
        .setPlaceholder('Select a clan action...')
        .addOptions([
            {
                label: 'View My Clan',
                description: 'Display the detailed profile and member list of your clan.',
                value: 'dashboard_view',
                emoji: '📜',
            },
            {
                label: 'Invite Member',
                description: 'Generate an invitation for a user to join your clan.',
                value: 'dashboard_invite',
                emoji: '📧',
            },
            {
                label: 'Manage Member Authority',
                description: 'Promote or demote an existing member of your clan.',
                value: 'dashboard_authority',
                emoji: '⬆️',
            },
            {
                label: 'Kick Member',
                description: 'Remove a member from your clan.',
                value: 'dashboard_kick',
                emoji: '👢',
            },
            {
                label: 'Set Clan Motto',
                description: 'Update or remove your clan\'s official motto.',
                value: 'dashboard_motto',
                emoji: '🖋️',
            },
            {
                label: 'Leave Clan',
                description: 'Leave the clan you are currently a member of.',
                value: 'dashboard_leave',
                emoji: '👋',
            },
        ]);

    return new ActionRowBuilder().addComponents(selectMenu);
}

async function sendOrUpdateDashboard(client) {
    const channelId = db.prepare('SELECT value FROM settings WHERE key = ?').get('dashboard_channel_id')?.value;
    let messageId = db.prepare('SELECT value FROM settings WHERE key = ?').get('dashboard_message_id')?.value;

    if (!channelId) {
        console.log('[Dashboard] No dashboard channel set. Skipping update.');
        return;
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
        console.error('[Dashboard] Could not fetch the dashboard channel. It may have been deleted.');
        return;
    }

    const embed = createDashboardEmbed();
    const components = createDashboardComponents();

    try {
        if (messageId) {
            const message = await channel.messages.fetch(messageId).catch(() => null);
            if (message) {
                await message.edit({ embeds: [embed], components: [components] });
                console.log('[Dashboard] Successfully refreshed the clan dashboard.');
                return; // Success
            }
        }

        // If messageId doesn't exist or message fetch failed, send a new one.
        const newMessage = await channel.send({ embeds: [embed], components: [components] });
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
            .run('dashboard_message_id', newMessage.id);
        console.log('[Dashboard] Sent a new clan dashboard and saved its ID.');

    } catch (error) {
        console.error('[Dashboard] Failed to send or update dashboard:', error);
    }
}

module.exports = {
    sendOrUpdateDashboard,
    createDashboardEmbed,
    createDashboardComponents
};