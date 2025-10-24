// src/managers/dashboardManager.js
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('../utils/database');
const { getRandomGif } = require('../helpers/dashboardHelpers');
const { formatTimestamp } = require('../helpers/timestampFormatter');

function createDashboardEmbed() {
    const randomGif = getRandomGif();
    // The timestamp is now generated every time the embed is created, ensuring it's always current.
    const nextUpdateTimestamp = Math.floor((Date.now() + 5 * 60 * 1000) / 1000);

    const description = "Welcome to the Clan Hall.\n\n" +
        "This is the central dashboard for all clan operations. Whether you are a seasoned leader or a new recruit, your journey begins here. Please select an action from the dropdown menu below.\n\n" +
        "Note: Certain actions require appropriate clan permissions to use.\n\n" +
        `*Updates ${formatTimestamp(nextUpdateTimestamp, 'R')}*`;

    return new EmbedBuilder()
        .setColor('#ff8100')
        .setTitle('<:Golden_Shield:1427763714760769617> Clan Receptionist Dashboard <:Golden_Shield:1427763714760769617>')
        .setDescription(description)
        .setImage(randomGif)
        .setFooter({ text: 'Mythweaver Studios | Clan Operations' });
}

function createDashboardComponents() {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('clan_dashboard_menu')
        .setPlaceholder('Select a clan action...')
        .addOptions([
            { label: 'View My Clan', description: 'Display the profile and member list of your clan.', value: 'dashboard_view', emoji: '📜' },
            { label: 'Manage Member Authority', description: 'Promote or demote a member of your clan.', value: 'dashboard_authority', emoji: '⬆️' },
            { label: 'Kick Member', description: 'Remove a member from your clan.', value: 'dashboard_kick', emoji: '👢' },
            { label: 'Set Clan Motto', description: 'Update or remove your clan\'s official motto.', value: 'dashboard_motto', emoji: '🖋️' },
            { label: 'Leave Clan', description: 'Leave the clan you are currently a member of.', value: 'dashboard_leave', emoji: '👋' },
        ]);

    return new ActionRowBuilder().addComponents(selectMenu);
}

async function sendOrUpdateDashboard(client, guildId) {
    const channelId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'dashboard_channel_id'").get(guildId)?.value;
    if (!channelId) return;
    
    let messageId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'dashboard_message_id'").get(guildId)?.value;

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
        console.error(`[Dashboard] Could not fetch the dashboard channel (${channelId}) for guild ${guildId}.`);
        return;
    }

    const embed = createDashboardEmbed();
    const components = createDashboardComponents();

    try {
        if (messageId) {
            const message = await channel.messages.fetch(messageId).catch(() => null);
            if (message) {
                await message.edit({ embeds: [embed], components: [components] });
                return;
            }
        }

        const allMessages = await channel.messages.fetch({ limit: 100 });
        const oldDashboard = allMessages.find(m => m.author.id === client.user.id && m.embeds[0]?.title?.includes('Clan Receptionist Dashboard'));
        if (oldDashboard) {
            await oldDashboard.delete().catch(() => {});
        }

        const newMessage = await channel.send({ embeds: [embed], components: [components] });
        db.prepare('INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, ?, ?)')
            .run(guildId, 'dashboard_message_id', newMessage.id);
            
        console.log(`[Dashboard] Sent a new clan dashboard to guild ${guildId} and saved its ID.`);

    } catch (error) {
        console.error('[Dashboard] Failed to send or update dashboard:', error);
    }
}

module.exports = {
    sendOrUpdateDashboard
};