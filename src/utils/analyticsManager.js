// src/utils/analyticsManager.js
const { EmbedBuilder } = require('discord.js');
const db = require('./database');

const GIFS = [
    'https://i.pinimg.com/originals/4c/5b/67/4c5b67093fdc45ae36e08ca67d9c59fa.gif',
    'https://i.pinimg.com/originals/a6/10/8b/a6108b31b391378d30856edba57172a4.gif',
    'https://i.pinimg.com/originals/d2/85/69/d285699262b0a27472b3fa8f7352c145.gif',
    'https://i.pinimg.com/originals/56/34/9f/56349f764173af321a640f6e1bac22fd.gif'
];

function getAnalyticsData(guildId) {
    const solyxData = db.prepare('SELECT SUM(balance) as total FROM wallets WHERE guild_id = ?').get(guildId);
    const clanData = db.prepare('SELECT COUNT(*) as total FROM clans WHERE guild_id = ?').get(guildId);
    return {
        totalSolyx: solyxData.total || 0,
        totalClans: clanData.total || 0,
    };
}

function createAnalyticsEmbed(guildId) { // Correctly accepts guildId
    const data = getAnalyticsData(guildId);
    const randomGif = GIFS[Math.floor(Math.random() * GIFS.length)];
    const nextUpdateTimestamp = Math.floor((Date.now() + 5 * 60 * 1000) / 1000);

    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('📊 Server Analytics Dashboard 📊')
        .addFields(
            { name: '💰 Total Solyx™ in Circulation', value: `> **${data.totalSolyx.toLocaleString()}** 🪙`, inline: false },
            { name: '🛡️ Registered Clans', value: `> **${data.totalClans.toLocaleString()}**`, inline: false }
        )
        .setImage(randomGif)
        .setFooter({ text: 'This dashboard updates automatically.' })
        .setTimestamp()

        embed.addFields({ name: 'Next Update', value: `<t:${nextUpdateTimestamp}:R>` });

    return { embeds: [embed] };
}

module.exports = { createAnalyticsEmbed };