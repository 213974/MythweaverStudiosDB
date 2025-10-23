// src/utils/analyticsManager.js
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('./database');
const { format, startOfWeek, endOfWeek, eachDayOfInterval, getDay } = require('date-fns');

const GIFS = [
    'https://i.pinimg.com/originals/56/34/9f/56349f764173af321a640f6e1bac22fd.gif',
    'https://i.pinimg.com/originals/a6/10/8b/a6108b31b391378d30856edba57172a4.gif',
    'https://i.pinimg.com/originals/9d/3e/2f/9d3e2f3f2e46a9f4dd0a016415433af8.gif',
    'https://i.pinimg.com/originals/0f/43/10/0f4310bc3442432f7667605968cc9e80.gif',
    'https://i.pinimg.com/originals/92/97/74/929774b033a66c070f5da21ef21c0090.gif',
    'https://i.pinimg.com/originals/d2/85/69/d285699262b0a27472b3fa8f7352c145.gif',
    'https://i.pinimg.com/originals/a3/63/9b/a3639be246d40f97fddbcd888b1b1a60.gif'
];

// --- Helper Functions ---

/**
 * Tracks the usage of a slash command for analytics purposes.
 * @param {string} guildId The guild where the command was used.
 * @param {string} userId The user who used the command.
 * @param {string} commandName The name of the command used.
 */
function trackCommandUsage(guildId, userId, commandName) {
    try {
        db.prepare('INSERT INTO command_stats (guild_id, user_id, command_name, timestamp) VALUES (?, ?, ?, ?)')
          .run(guildId, userId, commandName, new Date().toISOString());
    } catch (error) {
        console.error(`[Analytics] Failed to track command usage for /${commandName}:`, error);
    }
}

function getAnalyticsData(guildId) {
    // --- Total Economy Stats ---
    const solyxData = db.prepare('SELECT SUM(balance) as total FROM wallets WHERE guild_id = ?').get(guildId);
    const walletCountData = db.prepare('SELECT COUNT(DISTINCT user_id) as count FROM wallets WHERE guild_id = ?').get(guildId);

    // --- Weekly Stats Calculation ---
    const now = new Date();
    // Setting weekStartsOn: 1 makes Monday the first day of the week.
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const weekStartISO = weekStart.toISOString();
    const weekEndISO = weekEnd.toISOString();

    // 1. Get weekly command usage counts
    const dailyUsage = db.prepare("SELECT COUNT(*) as count FROM command_stats WHERE guild_id = ? AND command_name = 'daily' AND timestamp >= ? AND timestamp <= ?").get(guildId, weekStartISO, weekEndISO);
    const weeklyUsage = db.prepare("SELECT COUNT(*) as count FROM command_stats WHERE guild_id = ? AND command_name = 'weekly' AND timestamp >= ? AND timestamp <= ?").get(guildId, weekStartISO, weekEndISO);

    // 2. Get daily Solyx generation for the current week
    const daysInWeekSoFar = eachDayOfInterval({ start: weekStart, end: now });
    const dailySolyxAcquired = new Map();
    // Use an array of day names with Monday at index 0
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (const day of daysInWeekSoFar) {
        const dateStr = format(day, 'yyyy-MM-dd');
        // date-fns getDay(): Sunday is 0, Monday is 1...
        // We adjust so Monday is 0, Sunday is 6
        const dayIndex = (getDay(day) + 6) % 7; 
        const dayName = dayNames[dayIndex];
        const stats = db.prepare('SELECT total_solyx_acquired FROM daily_stats WHERE guild_id = ? AND date = ?').get(guildId, dateStr);
        dailySolyxAcquired.set(dayName, stats?.total_solyx_acquired || 0);
    }
    
    // --- Data Assembly ---
    const totalSolyx = solyxData?.total || 0;
    const userCount = walletCountData?.count || 0;
    const averageBalance = userCount > 0 ? Math.round(totalSolyx / userCount) : 0;
    
    return { 
        totalSolyx, 
        averageBalance, 
        dailyCommandUsage: dailyUsage?.count || 0,
        weeklyCommandUsage: weeklyUsage?.count || 0,
        solyxAcquiredThisWeek: dailySolyxAcquired
    };
}

function createAnalyticsEmbed(guildId) {
    const data = getAnalyticsData(guildId);
    const randomGif = GIFS[Math.floor(Math.random() * GIFS.length)];
    const nextUpdateTimestamp = Math.floor((Date.now() + 5 * 60 * 1000) / 1000);

    // --- Build Daily Solyx Acquired String ---
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let weeklySolyxString = weekDays.map(day => {
        if (data.solyxAcquiredThisWeek.has(day)) {
            return `**${day}:** ${data.solyxAcquiredThisWeek.get(day).toLocaleString()}`;
        }
        return `**${day}:** 0`; // Show 0 for days not yet occurred in the week
    }).join('\n');


    const embed = new EmbedBuilder()
        .setColor('#ff8100')
        .setTitle('<a:Orange_Flame:1427764664737202280> Server Analytics Dashboard <a:Orange_Flame:1427764664737202280>')
        .addFields(
            { name: '💰 Total Solyx™ in Circulation', value: `> **${data.totalSolyx.toLocaleString()}** <a:Yellow_Gem:1427764380489224295>`, inline: false },
            { name: '⚖️ Average User Balance', value: `> **${data.averageBalance.toLocaleString()}** <a:Yellow_Gem:1427764380489224295>`, inline: false },
            { 
                name: '📈 Weekly Command Usage', 
                value: `**/daily:** ${data.dailyCommandUsage.toLocaleString()} uses\n**/weekly:** ${data.weeklyCommandUsage.toLocaleString()} uses`,
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
        .setFooter({ text: 'Weekly stats reset on Monday.' })
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

module.exports = { createAnalyticsEmbed, trackCommandUsage };