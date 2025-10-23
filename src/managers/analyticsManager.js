// src/managers/analyticsManager.js
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('../utils/database');
const { format, startOfWeek, endOfWeek, eachDayOfInterval, getDay } = require('date-fns');
const { getRandomGif } = require('../helpers/dashboardHelpers');

// --- Helper Functions ---

/**
 * Tracks a successful claim for analytics purposes.
 * @param {string} guildId The guild where the claim occurred.
 * @param {string} userId The user who made the claim.
 * @param {'daily' | 'weekly'} claimType The type of claim.
 */
function trackSuccessfulClaim(guildId, userId, claimType) {
    try {
        db.prepare('INSERT INTO command_stats (guild_id, user_id, command_name, timestamp) VALUES (?, ?, ?, ?)')
          .run(guildId, userId, claimType, new Date().toISOString());
    } catch (error) {
        console.error(`[Analytics] Failed to track successful claim for ${claimType}:`, error);
    }
}

function getAnalyticsData(guildId) {
    const solyxData = db.prepare('SELECT SUM(balance) as total FROM wallets WHERE guild_id = ?').get(guildId);
    const walletCountData = db.prepare('SELECT COUNT(DISTINCT user_id) as count FROM wallets WHERE guild_id = ?').get(guildId);

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const weekStartISO = weekStart.toISOString();
    const weekEndISO = weekEnd.toISOString();

    const dailyClaims = db.prepare("SELECT COUNT(*) as count FROM command_stats WHERE guild_id = ? AND command_name = 'daily' AND timestamp >= ? AND timestamp <= ?").get(guildId, weekStartISO, weekEndISO);
    const weeklyClaims = db.prepare("SELECT COUNT(*) as count FROM command_stats WHERE guild_id = ? AND command_name = 'weekly' AND timestamp >= ? AND timestamp <= ?").get(guildId, weekStartISO, weekEndISO);

    const daysInWeekSoFar = eachDayOfInterval({ start: weekStart, end: now });
    const dailySolyxAcquired = new Map();
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (const day of daysInWeekSoFar) {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayIndex = (getDay(day) + 6) % 7; 
        const dayName = dayNames[dayIndex];
        const stats = db.prepare('SELECT total_solyx_acquired FROM daily_stats WHERE guild_id = ? AND date = ?').get(guildId, dateStr);
        dailySolyxAcquired.set(dayName, stats?.total_solyx_acquired || 0);
    }
    
    const totalSolyx = solyxData?.total || 0;
    const userCount = walletCountData?.count || 0;
    const averageBalance = userCount > 0 ? Math.round(totalSolyx / userCount) : 0;
    
    return { 
        totalSolyx, 
        averageBalance, 
        dailyClaimUsage: dailyClaims?.count || 0,
        weeklyClaimUsage: weeklyClaims?.count || 0,
        solyxAcquiredThisWeek: dailySolyxAcquired
    };
}

function createAnalyticsEmbed(guildId) {
    const data = getAnalyticsData(guildId);
    const randomGif = getRandomGif();
    const nextUpdateTimestamp = Math.floor((Date.now() + 5 * 60 * 1000) / 1000);

    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let weeklySolyxString = weekDays.map(day => {
        if (data.solyxAcquiredThisWeek.has(day)) {
            return `**${day}:** ${data.solyxAcquiredThisWeek.get(day).toLocaleString()}`;
        }
        return `**${day}:** 0`;
    }).join('\n');

    const embed = new EmbedBuilder()
        .setColor('#ff8100')
        .setTitle('<a:Orange_Flame:1427764664737202280> Server Analytics Dashboard <a:Orange_Flame:1427764664737202280>')
        .addFields(
            { name: '💰 Total Solyx™ in Circulation', value: `> **${data.totalSolyx.toLocaleString()}** <a:Yellow_Gem:1427764380489224295>`, inline: false },
            { name: '⚖️ Average User Balance', value: `> **${data.averageBalance.toLocaleString()}** <a:Yellow_Gem:1427764380489224295>`, inline: false },
            { 
                name: '📈 Weekly Successful Claims', 
                value: `**/daily:** ${data.dailyClaimUsage.toLocaleString()} claims\n**/weekly:** ${data.weeklyClaimUsage.toLocaleString()} claims`,
                inline: true
            },
            {
                name: '📊 Weekly Solyx™ Acquired',
                value: weeklySolyxString,
                inline: true
            },
            { name: 'Next Update', value: `<t:${nextUpdateTimestamp}:R>` }
        )
        .setImage(randomGif)
        .setFooter({ text: 'This dashboard updates automatically. Weekly stats reset on Monday.' })
        .setTimestamp();

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

module.exports = { createAnalyticsEmbed, trackSuccessfulClaim };