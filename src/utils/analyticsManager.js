// src/utils/analyticsManager.js
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('./database');

const GIFS = [
    'https://i.pinimg.com/originals/56/34/9f/56349f764173af321a640f6e1bac22fd.gif',
    'https://i.pinimg.com/originals/a6/10/8b/a6108b31b391378d30856edba57172a4.gif'
];

function getAnalyticsData(guildId) {
    const solyxData = db.prepare('SELECT SUM(balance) as total FROM wallets WHERE guild_id = ?').get(guildId);
    return {
        totalSolyx: solyxData.total || 0,
    };
}

function createAnalyticsEmbed(guildId) {
    const data = getAnalyticsData(guildId);
    const randomGif = GIFS[Math.floor(Math.random() * GIFS.length)];
    const nextUpdateTimestamp = Math.floor((Date.now() + 5 * 60 * 1000) / 1000);

    const embed = new EmbedBuilder()
        .setColor('#ff8100')
        .setTitle('📊 Server Analytics Dashboard 📊')
        .addFields(
            { name: '💰 Total Solyx™ in Circulation', value: `> **${data.totalSolyx.toLocaleString()}** 🪙`, inline: false }
        )
        .setImage(randomGif)
        .setFooter({ text: 'This dashboard updates automatically.' })
        .setTimestamp()
        .addFields({ name: 'Next Update', value: `<t:${nextUpdateTimestamp}:R>` });

    const adminMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('admin_panel_select') // This ID routes to the admin panel
            .setPlaceholder('⚙️ Administrative Actions...')
            .addOptions([
                {
                    label: 'Manage Economy',
                    description: 'Adjust user Solyx™ balances.',
                    value: 'admin_panel_economy',
                    emoji: '🪙',
                }
            ])
    );

    return { embeds: [embed], components: [adminMenu] };
}

module.exports = { createAnalyticsEmbed };