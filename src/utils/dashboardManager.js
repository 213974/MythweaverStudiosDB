// utils/dashboardManager.js
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('./database');

const GIFS = [
    'https://i.pinimg.com/originals/56/34/9f/56349f764173af321a640f6e1bac22fd.gif',
    'https://i.pinimg.com/originals/a6/10/8b/a6108b31b391378d30856edba57172a4.gif',
    'https://i.pinimg.com/originals/9d/3e/2f/9d3e2f3f2e46a9f4dd0a016415433af8.gif',
    'https://i.pinimg.com/originals/0f/43/10/0f4310bc3442432f7667605968cc9e80.gif',
    'https://i.pinimg.com/originals/92/97/74/929774b033a66c070f5da21ef21c0090.gif',
    'https://i.pinimg.com/originals/d2/85/69/d285699262b0a27472b3fa8f7352c145.gif',
    'https://i.pinimg.com/originals/a3/63/9b/a3639be246d40f97fddbcd888b1b1a60.gif'
];

function createDashboardEmbed() {
    const randomGif = GIFS[Math.floor(Math.random() * GIFS.length)];

    return new EmbedBuilder()
        .setColor('#ff8100')
        .setTitle('<:Golden_Shield:1427763714760769617> Clan Receptionist Dashboard <:Golden_Shield:1427763714760769617>')
        .setDescription(
            "Welcome to the Clan Hall.\n\n" +
            "This is the central dashboard for all clan operations. Whether you are a seasoned leader or a new recruit, your journey begins here. Please select an action from the dropdown menu below.\n\n" +
            "*Note: Certain actions require appropriate clan permissions to use.*"
        )
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

        const newMessage = await channel.send({ embeds: [embed], components: [components] });
        db.prepare('INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, ?, ?)')
            .run(guildId, 'dashboard_message_id', newMessage.id);
            
        console.log(`[Dashboard] Sent a new clan dashboard to guild ${guildId} and saved its ID.`);

    } catch (error) {
        console.error('[Dashboard] Failed to send or update dashboard:', error);
    }
}

module.exports = {
    sendOrUpdateDashboard,
    createDashboardEmbed,
    createDashboardComponents
};