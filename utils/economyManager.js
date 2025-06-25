// utils/economyManager.js
const db = require('./database');
const { differenceInHours, differenceInCalendarDays, startOfWeek, getDay, parseISO } = require('date-fns');

const DAILY_REWARD = 25;
const WEEKLY_REWARD = 175;
const DEFAULT_CURRENCY = 'Gold';

// --- Helper Functions ---
function ensureUser(userId, username = 'Unknown') {
    db.prepare('INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)').run(userId, username);
}

function ensureWallet(userId, currency) {
    ensureUser(userId);
    db.prepare('INSERT OR IGNORE INTO wallets (user_id, currency) VALUES (?, ?)').run(userId, currency);
}

// --- Main Exported Module ---
module.exports = {
    DEFAULT_CURRENCY,
    DAILY_REWARD,
    WEEKLY_REWARD,

    // --- Balance and Bank Management ---
    getWallet: (userId, currency = DEFAULT_CURRENCY) => {
        ensureWallet(userId, currency);
        return db.prepare('SELECT * FROM wallets WHERE user_id = ? AND currency = ?').get(userId, currency);
    },

    updateBalance: (userId, amount, currency = DEFAULT_CURRENCY) => {
        ensureWallet(userId, currency);
        db.prepare('UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND currency = ?').run(amount, userId, currency);
    },

    setBalance: (userId, amount, currency = DEFAULT_CURRENCY) => {
        ensureWallet(userId, currency);
        db.prepare('UPDATE wallets SET balance = ? WHERE user_id = ? AND currency = ?').run(amount, userId, currency);
    },

    depositToBank: (userId, amount, currency = DEFAULT_CURRENCY) => {
        const wallet = module.exports.getWallet(userId, currency);
        if (amount <= 0) return { success: false, message: 'Deposit amount must be positive.' };
        if (wallet.balance < amount) return { success: false, message: 'You do not have enough Gold in your balance.' };
        if (wallet.bank + amount > wallet.bank_capacity) return { success: false, message: 'You do not have enough space in your bank.' };

        const transaction = db.transaction(() => {
            db.prepare('UPDATE wallets SET balance = balance - ?, bank = bank + ? WHERE user_id = ? AND currency = ?').run(amount, amount, userId, currency);
        });
        transaction();
        return { success: true };
    },

    withdrawFromBank: (userId, amount, currency = DEFAULT_CURRENCY) => {
        const wallet = module.exports.getWallet(userId, currency);
        if (amount <= 0) return { success: false, message: 'Withdrawal amount must be positive.' };
        if (wallet.bank < amount) return { success: false, message: 'You do not have enough Gold in your bank.' };

        const transaction = db.transaction(() => {
            db.prepare('UPDATE wallets SET balance = balance + ?, bank = bank - ? WHERE user_id = ? AND currency = ?').run(amount, amount, userId, currency);
        });
        transaction();
        return { success: true };
    },

    transferGold: (fromUserId, toUserId, amount) => {
        const currency = 'Gold'; // Only Gold is transferable
        if (amount <= 0) return { success: false, message: 'Transfer amount must be positive.' };
        const senderWallet = module.exports.getWallet(fromUserId, currency);

        if (senderWallet.balance < amount) return { success: false, message: 'You do not have enough Gold in your balance to make this transfer.' };

        ensureWallet(toUserId, currency);

        const transaction = db.transaction(() => {
            module.exports.updateBalance(fromUserId, -amount, currency);
            module.exports.updateBalance(toUserId, amount, currency);
        });
        transaction();
        return { success: true };
    },

    // --- Daily & Weekly Claims ---
    getClaims: (userId) => {
        ensureUser(userId);
        const daily = db.prepare('SELECT * FROM claims WHERE user_id = ? AND claim_type = ?').get(userId, 'daily');
        const weekly = db.prepare('SELECT * FROM claims WHERE user_id = ? AND claim_type = ?').get(userId, 'weekly');
        return { daily, weekly };
    },

    getDailyStatus: (userId) => {
        const { daily } = module.exports.getClaims(userId);
        if (!daily) return { canClaim: true, weekly_claim_state: {} };

        const today = new Date();
        const lastClaimDate = parseISO(daily.last_claimed_at);
        const startOfThisWeek = startOfWeek(today, { weekStartsOn: 1 }); // Monday as start of week
        const startOfLastClaimWeek = startOfWeek(lastClaimDate, { weekStartsOn: 1 });

        let weeklyState = {};
        if (differenceInCalendarDays(startOfThisWeek, startOfLastClaimWeek) >= 7) {
            weeklyState = {};
        } else {
            weeklyState = JSON.parse(daily.weekly_claim_state || '{}');
        }

        const todayDayIndex = getDay(today);
        const canClaimToday = !weeklyState[todayDayIndex];

        return { canClaim: canClaimToday, weekly_claim_state: weeklyState };
    },

    claimDaily: (userId) => {
        const { canClaim, weekly_claim_state } = module.exports.getDailyStatus(userId);
        if (!canClaim) return { success: false, message: 'You have already claimed your daily reward today.' };

        const wallet = module.exports.getWallet(userId, 'Gold');
        if (wallet.bank + DAILY_REWARD > wallet.bank_capacity) {
            return { success: false, message: 'You do not have enough space in your bank to claim this reward.' };
        }

        const todayDayIndex = getDay(new Date());
        weekly_claim_state[todayDayIndex] = true;
        const newState = JSON.stringify(weekly_claim_state);

        const transaction = db.transaction(() => {
            db.prepare('UPDATE wallets SET bank = bank + ? WHERE user_id = ? AND currency = ?').run(DAILY_REWARD, userId, 'Gold');
            db.prepare('INSERT OR REPLACE INTO claims (user_id, claim_type, last_claimed_at, weekly_claim_state) VALUES (?, ?, ?, ?)').run(userId, 'daily', new Date().toISOString(), newState);
        });
        transaction();
        return { success: true, reward: DAILY_REWARD };
    },

    canClaimWeekly: (userId) => {
        const { weekly } = module.exports.getClaims(userId);
        if (!weekly) return { canClaim: true };

        const lastClaimDate = parseISO(weekly.last_claimed_at);
        const hoursSinceLastClaim = differenceInHours(new Date(), lastClaimDate);

        if (hoursSinceLastClaim >= 168) { // 7 * 24
            return { canClaim: true };
        } else {
            const nextClaimDate = new Date(lastClaimDate.getTime() + 168 * 60 * 60 * 1000);
            return { canClaim: false, nextClaim: nextClaimDate };
        }
    },

    claimWeekly: (userId) => {
        const { canClaim } = module.exports.canClaimWeekly(userId);
        if (!canClaim) return { success: false, message: 'You have already claimed your weekly reward.' };

        const wallet = module.exports.getWallet(userId, 'Gold');
        if (wallet.bank + WEEKLY_REWARD > wallet.bank_capacity) {
            return { success: false, message: 'You do not have enough space in your bank to claim this reward.' };
        }

        const transaction = db.transaction(() => {
            db.prepare('UPDATE wallets SET bank = bank + ? WHERE user_id = ? AND currency = ?').run(WEEKLY_REWARD, userId, 'Gold');
            db.prepare('INSERT OR REPLACE INTO claims (user_id, claim_type, last_claimed_at) VALUES (?, ?, ?)').run(userId, 'weekly', new Date().toISOString());
        });
        transaction();
        return { success: true, reward: WEEKLY_REWARD };
    },

    // --- Shop Management ---
    getShopItems: () => {
        return db.prepare('SELECT * FROM shop_items ORDER BY price ASC').all();
    },

    getShopItem: (roleId) => {
        return db.prepare('SELECT * FROM shop_items WHERE role_id = ?').get(roleId);
    },

    addShopItem: (roleId, price, name, description) => {
        try {
            db.prepare('INSERT INTO shop_items (role_id, price, name, description, currency) VALUES (?, ?, ?, ?, ?)')
                .run(roleId, price, name, description, 'Gold');
            return { success: true };
        } catch (error) {
            console.error('[EconomyManager] Error adding shop item:', error);
            return { success: false, message: 'Item might already exist or data is invalid.' };
        }
    },

    removeShopItem: (roleId) => {
        const result = db.prepare('DELETE FROM shop_items WHERE role_id = ?').run(roleId);
        return { success: result.changes > 0 };
    },

    updateShopItem: (roleId, newPrice) => {
        const result = db.prepare('UPDATE shop_items SET price = ? WHERE role_id = ?').run(newPrice, roleId);
        return { success: result.changes > 0 };
    },

    purchaseItem: (userId, roleId) => {
        const item = module.exports.getShopItem(roleId);
        if (!item) return { success: false, message: 'This item is not in the shop.' };

        const wallet = module.exports.getWallet(userId, item.currency);
        if (wallet.balance < item.price) {
            return { success: false, message: 'You do not have enough Gold in your balance to purchase this item.' };
        }

        module.exports.updateBalance(userId, -item.price, item.currency);
        return { success: true, price: item.price, currency: item.currency };
    },
};