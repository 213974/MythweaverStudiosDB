// utils/economyManager.js
const db = require('./database');
const { differenceInHours, differenceInCalendarDays, startOfWeek, getDay, parseISO } = require('date-fns');

const DAILY_REWARD = 10;
const WEEKLY_REWARD = 20;
const DEFAULT_CURRENCY = 'Solyx™';
const DEFAULT_WALLET_CAPACITY = 100000;

// --- Helper Functions ---
function ensureUser(userId, username = 'Unknown') {
    db.prepare('INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)').run(userId, username);
}

function ensureWallet(userId, guildId, currency = DEFAULT_CURRENCY) {
    ensureUser(userId);
    db.prepare('INSERT OR IGNORE INTO wallets (user_id, guild_id, currency, capacity) VALUES (?, ?, ?, ?)').run(userId, guildId, currency, DEFAULT_WALLET_CAPACITY);
}

function ensureClanWallet(clanId, guildId, currency = DEFAULT_CURRENCY) {
    db.prepare('INSERT OR IGNORE INTO clan_wallets (clan_id, guild_id, currency) VALUES (?, ?, ?)').run(clanId, guildId, currency);
}


// --- Main Exported Module ---
module.exports = {
    DEFAULT_CURRENCY,
    DAILY_REWARD,
    WEEKLY_REWARD,

    // --- Player Wallet Management ---
    getWallet: (userId, guildId, currency = DEFAULT_CURRENCY) => {
        ensureWallet(userId, guildId, currency);
        return db.prepare('SELECT * FROM wallets WHERE user_id = ? AND guild_id = ? AND currency = ?').get(userId, guildId, currency);
    },

    // --- THIS IS THE NEW FUNCTION ---
    getConsolidatedBalance: (userId, guildId) => {
        ensureUser(userId); // Ensure the user exists in the database first.
        const result = db.prepare(`
            SELECT SUM(balance) as total 
            FROM wallets 
            WHERE user_id = ? AND guild_id = ?
        `).get(userId, guildId);
        return result.total || 0;
    },

    // --- Clan Wallet (Guild Bank) Management ---

    getClanWallet: (clanId, guildId, currency = DEFAULT_CURRENCY) => {
        ensureClanWallet(clanId, guildId, currency);
        return db.prepare('SELECT * FROM clan_wallets WHERE clan_id = ? AND guild_id = ? AND currency = ?').get(clanId, guildId, currency);
    },
    depositToClanWallet: (userId, guildId, clanId, amount, currency = DEFAULT_CURRENCY) => {
        if (amount <= 0) return { success: false, message: 'Deposit amount must be positive.' };
        const userWallet = module.exports.getWallet(userId, guildId, currency);
        if (userWallet.balance < amount) return { success: false, message: `You do not have enough ${DEFAULT_CURRENCY} to deposit.` };
        ensureClanWallet(clanId, guildId, currency);
        db.transaction(() => {
            db.prepare('UPDATE wallets SET balance = balance - ? WHERE user_id = ? AND guild_id = ? AND currency = ?').run(amount, userId, guildId, currency);
            db.prepare('UPDATE clan_wallets SET balance = balance + ? WHERE clan_id = ? AND guild_id = ? AND currency = ?').run(amount, clanId, guildId, currency);
        })();
        return { success: true };
    },
    withdrawFromClanWallet: (userId, guildId, clanId, amount, currency = DEFAULT_CURRENCY) => {
        if (amount <= 0) return { success: false, message: 'Withdrawal amount must be positive.' };
        const clanWallet = module.exports.getClanWallet(clanId, guildId, currency);
        if (clanWallet.balance < amount) return { success: false, message: `The clan bank does not have enough ${DEFAULT_CURRENCY}.` };
        db.transaction(() => {
            db.prepare('UPDATE clan_wallets SET balance = balance - ? WHERE clan_id = ? AND guild_id = ? AND currency = ?').run(amount, clanId, guildId, currency);
            db.prepare('UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND guild_id = ? AND currency = ?').run(amount, userId, guildId, currency);
        })();
        return { success: true };
    },

    // --- Claim System ---

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
        const today = new Date();
        const todayDayIndex = getDay(today);
        const updatedWeeklyState = { ...weekly_claim_state };
        updatedWeeklyState[todayDayIndex] = true;
        const weeklyStateJson = JSON.stringify(updatedWeeklyState);

        db.transaction(() => {
            db.prepare('UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND guild_id = ? AND currency = ?')
                .run(DAILY_REWARD, userId, guildId, DEFAULT_CURRENCY);
            db.prepare(`
                INSERT INTO claims (user_id, guild_id, claim_type, last_claimed_at, streak, weekly_claim_state)
                VALUES (?, ?, 'daily', ?, 1, ?)
                ON CONFLICT(user_id, guild_id, claim_type) DO UPDATE SET
                last_claimed_at = excluded.last_claimed_at,
                streak = streak + 1,
                weekly_claim_state = excluded.weekly_claim_state;
            `).run(userId, guildId, today.toISOString(), weeklyStateJson);
            
            const userRecord = db.prepare('SELECT referred_by FROM users WHERE user_id = ?').get(userId);
            if (userRecord && userRecord.referred_by) {
                const inviterId = userRecord.referred_by;
                const passiveBonus = Math.floor(DAILY_REWARD * 0.10);
                if (passiveBonus > 0) {
                    db.prepare('UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND guild_id = ? AND currency = ?').run(passiveBonus, inviterId, guildId, DEFAULT_CURRENCY);
                    db.prepare('INSERT INTO transactions (user_id, guild_id, amount, reason, timestamp) VALUES (?, ?, ?, ?, ?)').run(inviterId, guildId, passiveBonus, `Passive bonus from user ${userId}`, new Date().toISOString());
                }
            }
        })();

        return { success: true, reward: DAILY_REWARD };
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
        db.prepare('UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND guild_id = ? AND currency = ?').run(WEEKLY_REWARD, userId, guildId, DEFAULT_CURRENCY);
        db.prepare('INSERT OR REPLACE INTO claims (user_id, guild_id, claim_type, last_claimed_at) VALUES (?, ?, ?, ?)').run(userId, guildId, 'weekly', new Date().toISOString());
        return { success: true, reward: WEEKLY_REWARD };
    },

    // --- Shop Management ---
    getShopItems: (guildId) => db.prepare('SELECT * FROM shop_items WHERE guild_id = ? ORDER BY price ASC').all(guildId),
    getShopItem: (roleId, guildId) => db.prepare('SELECT * FROM shop_items WHERE role_id = ? AND guild_id = ?').get(roleId, guildId),
    addShopItem: (roleId, guildId, price, name, description) => {
        try {
            db.prepare('INSERT INTO shop_items (role_id, guild_id, price, name, description, currency) VALUES (?, ?, ?, ?, ?, ?)').run(roleId, guildId, price, name, description, DEFAULT_CURRENCY);
            return { success: true };
        } catch (error) { return { success: false, message: 'Item might already exist.' }; }
    },
    removeShopItem: (roleId, guildId) => {
        const result = db.prepare('DELETE FROM shop_items WHERE role_id = ? AND guild_id = ?').run(roleId, guildId);
        return { success: result.changes > 0 };
    },
    updateShopItem: (roleId, guildId, newPrice) => {
        const result = db.prepare('UPDATE shop_items SET price = ? WHERE role_id = ? AND guild_id = ?').run(newPrice, roleId, guildId);
        return { success: result.changes > 0 };
    },
    purchaseItem: (userId, guildId, roleId) => {
        const item = module.exports.getShopItem(roleId, guildId);
        if (!item) return { success: false, message: 'This item is not in the shop.' };
        const wallet = module.exports.getWallet(userId, guildId, item.currency);
        if (wallet.balance < item.price) return { success: false, message: `You do not have enough ${item.currency}.` };
        db.prepare('UPDATE wallets SET balance = balance - ? WHERE user_id = ? AND guild_id = ? AND currency = ?').run(item.price, userId, guildId, item.currency);
        return { success: true, price: item.price, currency: item.currency };
    },

    // --- Leaderboard Functions ---
    getTopUsers: (guildId, limit = 25) => {
        return db.prepare(`
            SELECT user_id, SUM(balance) as balance 
            FROM wallets 
            WHERE guild_id = ? 
            GROUP BY user_id 
            ORDER BY balance DESC 
            LIMIT ?
        `).all(guildId, limit);
    },

    getUserRank: (userId, guildId) => {
        const allUsers = db.prepare(`
            SELECT user_id, SUM(balance) as balance 
            FROM wallets 
            WHERE guild_id = ? 
            GROUP BY user_id 
            ORDER BY balance DESC
        `).all(guildId);
        
        const rank = allUsers.findIndex(user => user.user_id === userId) + 1;
        
        if (rank === 0) return null; // User not found
        return { rank, balance: allUsers[rank - 1].balance };
    },
};