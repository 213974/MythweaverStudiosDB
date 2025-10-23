// src/managers/userManager.js
const db = require('../utils/database');

const LEVEL_CONSTANT = 100;

function ensureUserStats(userId, guildId) {
    db.prepare('INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)').run(userId, 'Unknown');
    db.prepare('INSERT OR IGNORE INTO user_stats (user_id, guild_id) VALUES (?, ?)').run(userId, guildId);
}

function createProgressBar(progress) {
    const filledBlocks = Math.round(progress * 10);
    const emptyBlocks = 10 - filledBlocks;
    return '▰'.repeat(filledBlocks) + '▱'.repeat(emptyBlocks);
}

module.exports = {
    getUserStats: (userId, guildId) => {
        ensureUserStats(userId, guildId);
        return db.prepare('SELECT * FROM user_stats WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
    },

    addSolyxFromSource: (userId, guildId, amount, source) => {
        ensureUserStats(userId, guildId);
        if (source === 'message') {
            db.prepare('UPDATE user_stats SET total_solyx_from_messages = total_solyx_from_messages + ? WHERE user_id = ? AND guild_id = ?').run(amount, userId, guildId);
        } else if (source === 'vc') {
            db.prepare('UPDATE user_stats SET total_solyx_from_vc = total_solyx_from_vc + ? WHERE user_id = ? AND guild_id = ?').run(amount, userId, guildId);
        }
    },

    incrementVcTime: (userId, guildId, timeMs) => {
        ensureUserStats(userId, guildId);
        db.prepare('UPDATE user_stats SET total_vc_time_ms = total_vc_time_ms + ? WHERE user_id = ? AND guild_id = ?').run(timeMs, userId, guildId);
    },

    calculateLevel: (totalSolyx) => {
        if (totalSolyx < 0) totalSolyx = 0;

        const level = Math.floor(Math.sqrt(totalSolyx / LEVEL_CONSTANT)) + 1;
        
        const xpForCurrentLevel = LEVEL_CONSTANT * Math.pow(level - 1, 2);
        const xpForNextLevel = LEVEL_CONSTANT * Math.pow(level, 2);

        const xpInCurrentLevel = totalSolyx - xpForCurrentLevel;
        const xpNeededForNextLevel = xpForNextLevel - xpForCurrentLevel;

        const progress = xpNeededForNextLevel > 0 ? (xpInCurrentLevel / xpNeededForNextLevel) : 0;
        
        return {
            level,
            progress,
            xpInCurrentLevel,
            xpNeededForNextLevel
        };
    },

    createProgressBar
};