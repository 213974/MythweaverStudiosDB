// src/managers/userManager.js
const db = require('../utils/database');

const LEVEL_CONSTANT = 100; // Adjust this to make leveling faster or slower

/**
 * Ensures a user has an entry in the user_stats table.
 * @param {string} userId The user's ID.
 * @param {string} guildId The guild's ID.
 */
function ensureUserStats(userId, guildId) {
    db.prepare('INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)').run(userId, 'Unknown');
    db.prepare('INSERT OR IGNORE INTO user_stats (user_id, guild_id) VALUES (?, ?)').run(userId, guildId);
}

module.exports = {
    /**
     * Retrieves all stats for a given user in a specific guild.
     * @param {string} userId The user's ID.
     * @param {string} guildId The guild's ID.
     * @returns {object} The user's stats object.
     */
    getUserStats: (userId, guildId) => {
        ensureUserStats(userId, guildId);
        return db.prepare('SELECT * FROM user_stats WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
    },

    /**
     * Adds Solyx™ earned from a specific source to the user's stats for profile tracking.
     * @param {string} userId The user's ID.
     * @param {string} guildId The guild's ID.
     * @param {number} amount The amount of Solyx™ to add.
     * @param {'message' | 'vc'} source The source of the Solyx™.
     */
    addSolyxFromSource: (userId, guildId, amount, source) => {
        ensureUserStats(userId, guildId);
        if (source === 'message') {
            db.prepare('UPDATE user_stats SET total_solyx_from_messages = total_solyx_from_messages + ? WHERE user_id = ? AND guild_id = ?').run(amount, userId, guildId);
        } else if (source === 'vc') {
            db.prepare('UPDATE user_stats SET total_solyx_from_vc = total_solyx_from_vc + ? WHERE user_id = ? AND guild_id = ?').run(amount, userId, guildId);
        }
    },

    /**
     * Increments the total time a user has spent in eligible voice channels.
     * @param {string} userId The user's ID.
     * @param {string} guildId The guild's ID.
     * @param {number} timeMs The time in milliseconds to add.
     */
    incrementVcTime: (userId, guildId, timeMs) => {
        ensureUserStats(userId, guildId);
        db.prepare('UPDATE user_stats SET total_vc_time_ms = total_vc_time_ms + ? WHERE user_id = ? AND guild_id = ?').run(timeMs, userId, guildId);
    },

    /**
     * Calculates a user's level based on their total Solyx™ (XP).
     * The formula is: totalXP needed for level L = 100 * (L-1)^2
     * @param {number} totalSolyx The user's total Solyx™.
     * @returns {{level: number, progress: number, xpForCurrentLevel: number, xpForNextLevel: number, xpInCurrentLevel: number}}
     */
    calculateLevel: (totalSolyx) => {
        if (totalSolyx < 0) totalSolyx = 0;

        // Reverse the formula to find the level from XP: L = sqrt(totalXP / 100) + 1
        const level = Math.floor(Math.sqrt(totalSolyx / LEVEL_CONSTANT)) + 1;
        
        // Calculate the XP thresholds for the current and next levels
        const xpForCurrentLevel = LEVEL_CONSTANT * Math.pow(level - 1, 2);
        const xpForNextLevel = LEVEL_CONSTANT * Math.pow(level, 2);

        // Calculate progress within the current level
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

    /**
     * Creates a 10-character progress bar string.
     * @param {number} progress A value between 0 and 1.
     * @returns {string} The progress bar string.
     */
    createProgressBar: (progress) => {
        const filledBlocks = Math.round(progress * 10);
        const emptyBlocks = 10 - filledBlocks;
        return '▰'.repeat(filledBlocks) + '▱'.repeat(emptyBlocks);
    }
};