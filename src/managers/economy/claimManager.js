// src/managers/economy/claimManager.js
const db = require('../../utils/database');
const walletManager = require('./walletManager');
const { differenceInHours, differenceInCalendarDays, startOfWeek, getDay, parseISO } = require('date-fns');

// --- Helper Functions ---

function getEconomySetting(guildId, key, defaultValue) {
    const setting = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = ?").get(guildId, key);
    return setting ? parseFloat(setting.value) : defaultValue;
}

function ensureUser(userId, username = 'Unknown') {
    db.prepare('INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)').run(userId, username);
}

// --- Core Module ---

module.exports = {
    getDailyReward: (guildId) => getEconomySetting(guildId, 'economy_daily_reward', 1),
    getWeeklyReward: (guildId) => getEconomySetting(guildId, 'economy_weekly_reward', 2),

    getClaims: (userId, guildId) => {
        ensureUser(userId);
        const daily = db.prepare('SELECT * FROM claims WHERE user_id = ? AND guild_id = ? AND claim_type = ?').get(userId, guildId, 'daily');
        const weekly = db.prepare('SELECT * FROM claims WHERE user_id = ? AND guild_id = ? AND claim_type = ?').get(userId, guildId, 'weekly');
        return { daily, weekly };
    },

    getDailyStatus: (userId, guildId) => {
        const { daily } = module.exports.getClaims(userId, guildId);
        if (!daily) return { canClaim: true, weekly_claim_state: {} };
        const today = new Date();
        const lastClaimDate = parseISO(daily.last_claimed_at);
        const startOfThisWeek = startOfWeek(today, { weekStartsOn: 1 });
        const startOfLastClaimWeek = startOfWeek(lastClaimDate, { weekStartsOn: 1 });
        let weeklyState = differenceInCalendarDays(startOfThisWeek, startOfLastClaimWeek) >= 7 ? {} : JSON.parse(daily.weekly_claim_state || '{}');
        const todayDayIndex = getDay(today);
        if (!weeklyState[todayDayIndex]) {
            return { canClaim: true, weekly_claim_state: weeklyState };
        } else {
            const midnight = new Date();
            midnight.setHours(24, 0, 0, 0);
            return { canClaim: false, weekly_claim_state: weeklyState, nextClaim: midnight };
        }
    },

    claimDaily: (userId, guildId) => {
        const { canClaim, weekly_claim_state } = module.exports.getDailyStatus(userId, guildId);
        if (!canClaim) {
            return { success: false, message: 'You have already claimed your daily reward today.' };
        }
        
        const dailyReward = module.exports.getDailyReward(guildId);
        const result = walletManager.modifySolyx(userId, guildId, dailyReward, 'Daily Claim');
        if (!result.success) {
            return { success: false, message: 'A database error occurred while claiming.' };
        }
        
        // Local require to prevent circular dependency (analyticsManager -> walletManager)
        const { trackSuccessfulClaim } = require('../analyticsManager');
        trackSuccessfulClaim(guildId, userId, 'daily');

        const today = new Date();
        const todayDayIndex = getDay(today);
        const updatedWeeklyState = { ...weekly_claim_state };
        updatedWeeklyState[todayDayIndex] = true;
        const weeklyStateJson = JSON.stringify(updatedWeeklyState);

        db.transaction(() => {
            db.prepare(`
                INSERT INTO claims (user_id, guild_id, claim_type, last_claimed_at, streak, weekly_claim_state)
                VALUES (?, ?, 'daily', ?, 1, ?)
                ON CONFLICT(user_id, guild_id, claim_type) DO UPDATE SET
                last_claimed_at = excluded.last_claimed_at,
                streak = streak + 1,
                weekly_claim_state = excluded.weekly_claim_state;
            `).run(userId, guildId, today.toISOString(), weeklyStateJson);
            
            if (dailyReward > 0) {
                const userRecord = db.prepare('SELECT referred_by FROM users WHERE user_id = ?').get(userId);
                if (userRecord && userRecord.referred_by) {
                    const inviterId = userRecord.referred_by;
                    const passiveBonus = dailyReward * 0.10;
                    if (passiveBonus > 0) {
                        walletManager.modifySolyx(inviterId, guildId, passiveBonus, `Passive bonus from user ${userId}`);
                    }
                }
            }
        })();

        return { success: true, reward: dailyReward, newBalance: result.newBalance };
    },

    canClaimWeekly: (userId, guildId) => {
        const { weekly } = module.exports.getClaims(userId, guildId);
        if (!weekly) return { canClaim: true };
        const lastClaimDate = parseISO(weekly.last_claimed_at);
        const hoursSinceLastClaim = differenceInHours(new Date(), lastClaimDate);
        if (hoursSinceLastClaim >= 168) {
            return { canClaim: true };
        } else {
            const nextClaimDate = new Date(lastClaimDate.getTime() + 168 * 60 * 60 * 1000);
            return { canClaim: false, nextClaim: nextClaimDate };
        }
    },

    claimWeekly: (userId, guildId) => {
        const { canClaim } = module.exports.canClaimWeekly(userId, guildId);
        if (!canClaim) return { success: false, message: 'You have already claimed your weekly reward.' };
        
        const weeklyReward = module.exports.getWeeklyReward(guildId);
        const result = walletManager.modifySolyx(userId, guildId, weeklyReward, 'Weekly Claim');
        if (!result.success) {
            return { success: false, message: 'A database error occurred while claiming.' };
        }

        // Local require to prevent circular dependency
        const { trackSuccessfulClaim } = require('../analyticsManager');
        trackSuccessfulClaim(guildId, userId, 'weekly');

        db.prepare('INSERT OR REPLACE INTO claims (user_id, guild_id, claim_type, last_claimed_at) VALUES (?, ?, ?, ?)').run(userId, guildId, 'weekly', new Date().toISOString());
        return { success: true, reward: weeklyReward, newBalance: result.newBalance };
    },
};