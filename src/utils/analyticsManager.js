// src/utils/analyticsManager.js
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('./database');
const { format, subDays } = require('date-fns');

const GIFS = [
    'https://i.pinimg.com/originals/56/34/9f/56349f764173af321a640f6e1bac22fd.gif',
    'https://i.pinimg.com/originals/a6/10/8b/a6108b31b391378d30856edba57172a4.gif',
    'https://i.pinimg.com/originals/9d/3e/2f/9d3e2f3f2e46a9f4dd0a016415433af8.gif',
    'https://i.pinimg.com/originals/0f/43/10/0f4310bc3442432f7667605968cc9e80.gif',
    'https://i.pinimg.com/originals/92/97/74/929774b033a66c070f5da21ef21c0090.gif',
    'https://i.pinimg.com/originals/d2/85/69/d285699262b0a27472b3fa8f7352c145.gif',
    'https://i.pinimg.com/originals/a3/63/9b/a3639be246d40f97fddbcd888b1b1a60.gif'
];

function getAnalyticsData(guildId) {
    const solyxData = db.prepare('SELECT SUM(balance) as total FROM wallets WHERE guild_id = ?').get(guildId);
    const walletCountData = db.prepare('SELECT COUNT(DISTINCT user_id) as count FROM wallets WHERE guild_id = ?').get(guildId);
    
    // --- NEW: Fetch daily generation stats ---
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');

    const todayStats = db.prepare('SELECT total_solyx_acquired FROM daily_stats WHERE guild_id = ? AND date = ?').get(guildId, todayStr);
    const yesterdayStats = db.prepare('SELECT total_solyx_acquired FROM daily_stats WHERE guild_id = ? AND date = ?').get(guildId, yesterdayStr);

    const totalSolyx = solyxData.total || 0;
    const userCount = walletCountData.count || 0;
    const averageBalance = userCount > 0 ? Math.round(totalSolyx / userCount) : 0;
    const dailySolyxAcquired = todayStats?.total_solyx_acquired || 0;
    const yesterdaySolyxAcquired = yesterdayStats?.total_solyx_acquired || 0;

    return { totalSolyx, averageBalance, dailySolyxAcquired, yesterdaySolyxAcquired };
}

function createAnalyticsEmbed(guildId) {
    const data = getAnalyticsData(guildId);
    const randomGif = GIFS[Math.floor(Math.random() * GIFS.length)];
    const nextUpdateTimestamp = Math.floor((Date.now() + 5 * 60 * 1000) / 1000);

    // --- NEW: Calculate trend for daily generation ---
    let trendString = ' (vs yesterday)';
    if (data.yesterdaySolyxAcquired > 0) {
        const percentChange = ((data.dailySolyxAcquired - data.yesterdaySolyxAcquired) / data.yesterdaySolyxAcquired) * 100;
        if (percentChange > 0) {
            trendString = ` *(<:Green_Arrow_Up:1427763654522437652> +${percentChange.toFixed(0)}%)*`;
        } else if (percentChange < 0) {
            trendString = ` *(<:Red_Arrow_Down:1427763683196272670> ${percentChange.toFixed(0)}%)*`;
        } else {
            trendString = ' *(No change)*';
        }
    } else if (data.dailySolyxAcquired > 0) {
        trendString = ' *(First day of data)*';
    } else {
        trendString = '';
    }

    const embed = new EmbedBuilder()
        .setColor('#ff8100')
        .setTitle('<a:Orange_Flame:1427764664737202280> Server Analytics Dashboard <a:Orange_Flame:1427764664737202280>')
        .addFields(
            { name: '💰 Total Solyx™ in Circulation', value: `> **${data.totalSolyx.toLocaleString()}** <a:Yellow_Gem:1427764380489224295>`, inline: false },
            { name: '⚖️ Average User Balance', value: `> **${data.averageBalance.toLocaleString()}** <a:Yellow_Gem:1427764380489224295>`, inline: true },
            // --- NEW: Display the daily metric ---
            { name: '📈 Daily Solyx™ Acquired', value: `> **${data.dailySolyxAcquired.toLocaleString()}**${trendString}`, inline: true }
        )
        .setImage(randomGif)
        .setFooter({ text: 'This dashboard updates automatically.' })
        .setTimestamp()
        .addFields({ name: 'Next Update', value: `<t:${nextUpdateTimestamp}:R>` });

    const adminMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('admin_panel_select')
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