// utils/economyManager.js
const db = require('./database');
const { differenceInHours, differenceInCalendarDays, startOfWeek, getDay, parseISO } = require('date-fns');

const DAILY_REWARD = 25;
const WEEKLY_REWARD = 175;
const DEFAULT_CURRENCY = 'Solyx™';
const DEFAULT_WALLET_CAPACITY = 100000;

// --- Helper Functions ---
function ensureUser(userId, username = 'Unknown') {
    db.prepare('INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)').run(userId, username);
}

function ensureWallet(userId, currency = DEFAULT_CURRENCY) {
    ensureUser(userId);
    db.prepare('INSERT OR IGNORE INTO wallets (user_id, currency, capacity) VALUES (?, ?, ?)').run(userId, currency, DEFAULT_WALLET_CAPACITY);
}

function ensureClanWallet(clanId, currency = DEFAULT_CURRENCY) {
    db.prepare('INSERT OR IGNORE INTO clan_wallets (clan_id, currency) VALUES (?, ?)').run(clanId, currency);
}


// --- Main Exported Module ---
module.exports = {
    DEFAULT_CURRENCY,
    DAILY_REWARD,
    WEEKLY_REWARD,
    ensureUser, // Exporting for broader use if needed

    // --- Player Wallet Management ---

    getWallet: (userId, currency = DEFAULT_CURRENCY) => {
        ensureWallet(userId, currency);
        return db.prepare('SELECT * FROM wallets WHERE user_id = ? AND currency = ?').get(userId, currency);
    },

    // --- Clan Wallet (Guild Bank) Management ---

    getClanWallet: (clanId, currency = DEFAULT_CURRENCY) => {
        ensureClanWallet(clanId, currency);
        return db.prepare('SELECT * FROM clan_wallets WHERE clan_id = ? AND currency = ?').get(clanId, currency);
    },

    depositToClanWallet: (userId, clanId, amount, currency = DEFAULT_CURRENCY) => {
        if (amount <= 0) return { success: false, message: 'Deposit amount must be positive.' };
        const userWallet = module.exports.getWallet(userId, currency);

        if (userWallet.balance < amount) {
            return { success: false, message: `You do not have enough ${DEFAULT_CURRENCY} to deposit.` };
        }

        ensureClanWallet(clanId, currency);
        const transaction = db.transaction(() => {
            db.prepare('UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND currency = ?').run(WEEKLY_REWARD, userId, DEFAULT_CURRENCY);
            db.prepare('UPDATE clan_wallets SET balance = balance + ? WHERE clan_id = ? AND currency = ?').run(amount, clanId, currency);
        });
        transaction();
        return { success: true };
    },

    withdrawFromClanWallet: (userId, clanId, amount, currency = DEFAULT_CURRENCY) => {
        if (amount <= 0) return { success: false, message: 'Withdrawal amount must be positive.' };
        const clanWallet = module.exports.getClanWallet(clanId, currency);
        const userWallet = module.exports.getWallet(userId, currency);

        if (clanWallet.balance < amount) {
            return { success: false, message: `The clan bank does not have enough ${DEFAULT_CURRENCY} to withdraw.` };
        }
        if (userWallet.balance + amount > userWallet.capacity) {
            return { success: false, message: 'Your personal wallet does not have enough space for this withdrawal.' };
        }

        const transaction = db.transaction(() => {
            db.prepare('UPDATE clan_wallets SET balance = balance - ? WHERE clan_id = ? AND currency = ?').run(amount, clanId, currency);
            db.prepare('UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND currency = ?').run(amount, userId, currency);
        });
        transaction();
        return { success: true };
    },

    // --- Claim System ---

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
        const startOfThisWeek = startOfWeek(today, { weekStartsOn: 1 });
        const startOfLastClaimWeek = startOfWeek(lastClaimDate, { weekStartsOn: 1 });

        let weeklyState = {};
        // Reset weekly progress if the last claim was in a previous week
        if (differenceInCalendarDays(startOfThisWeek, startOfLastClaimWeek) >= 7) {
            weeklyState = {};
        } else {
            weeklyState = JSON.parse(daily.weekly_claim_state || '{}');
        }

        const todayDayIndex = getDay(today);
        if (!weeklyState[todayDayIndex]) {
            return { canClaim: true, weekly_claim_state: weeklyState };
        } else {
            const midnight = new Date();
            midnight.setHours(24, 0, 0, 0);
            return { canClaim: false, weekly_claim_state: weeklyState, nextClaim: midnight };
        }
    },

    claimDaily: (userId) => {
        const { canClaim } = module.exports.getDailyStatus(userId);
        if (!canClaim) return { success: false, message: 'You have already claimed your daily reward today.' };

        const wallet = module.exports.getWallet(userId, DEFAULT_CURRENCY);
        if (wallet.balance + DAILY_REWARD > wallet.capacity) {
            return { success: false, message: 'You do not have enough space in your wallet to claim this reward.' };
        }

        const transaction = db.transaction(() => {
            // Give the daily reward to the claimer
            db.prepare('UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND currency = ?').run(DAILY_REWARD, userId, DEFAULT_CURRENCY);
            
            // Update their claim status and streak
            // (This assumes a simplified streak logic for now)
            db.prepare('INSERT OR REPLACE INTO claims (user_id, claim_type, last_claimed_at, streak) VALUES (?, ?, ?, COALESCE((SELECT streak FROM claims WHERE user_id = ? AND claim_type = ?), 0) + 1)')
                .run(userId, 'daily', new Date().toISOString(), userId, 'daily');
            
            // --- Referral Passive Bonus Logic ---
            const userRecord = db.prepare('SELECT referred_by FROM users WHERE user_id = ?').get(userId);
            if (userRecord && userRecord.referred_by) {
                const inviterId = userRecord.referred_by;
                const passiveBonus = Math.floor(DAILY_REWARD * 0.10); // 10% bonus
                
                if (passiveBonus > 0) {
                    const inviterWallet = module.exports.getWallet(inviterId);
                    // Silently fail if inviter's wallet is full
                    if (inviterWallet.balance + passiveBonus <= inviterWallet.capacity) {
                        db.prepare('UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND currency = ?').run(passiveBonus, inviterId, DEFAULT_CURRENCY);
                        
                        // Log the passive income
                        db.prepare('INSERT INTO transactions (user_id, amount, reason, timestamp) VALUES (?, ?, ?, ?)')
                            .run(inviterId, passiveBonus, `Passive bonus from user ${userId}`, new Date().toISOString());
                    }
                }
            }
        });

        transaction();
        return { success: true, reward: DAILY_REWARD };
    },

    canClaimWeekly: (userId) => {
        const { weekly } = module.exports.getClaims(userId);
        if (!weekly) return { canClaim: true };

        const lastClaimDate = parseISO(weekly.last_claimed_at);
        const hoursSinceLastClaim = differenceInHours(new Date(), lastClaimDate);

        if (hoursSinceLastClaim >= 168) { // 7 days * 24 hours
            return { canClaim: true };
        } else {
            const nextClaimDate = new Date(lastClaimDate.getTime() + 168 * 60 * 60 * 1000);
            return { canClaim: false, nextClaim: nextClaimDate };
        }
    },

    claimWeekly: (userId) => {
        const { canClaim } = module.exports.canClaimWeekly(userId);
        if (!canClaim) return { success: false, message: 'You have already claimed your weekly reward.' };

        const wallet = module.exports.getWallet(userId, DEFAULT_CURRENCY);
        if (wallet.balance + WEEKLY_REWARD > wallet.capacity) {
            return { success: false, message: 'You do not have enough space in your wallet to claim this reward.' };
        }

        db.prepare('UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND currency = ?').run(WEEKLY_REWARD, userId, DEFAULT_CURREY);
        db.prepare('INSERT OR REPLACE INTO claims (user_id, claim_type, last_claimed_at) VALUES (?, ?, ?)').run(userId, 'weekly', new Date().toISOString());

        return { success: true, reward: WEEKLY_REWARD };
    },

    // --- Shop Management ---

    getShopItems: () => db.prepare('SELECT * FROM shop_items ORDER BY price ASC').all(),

    getShopItem: (roleId) => db.prepare('SELECT * FROM shop_items WHERE role_id = ?').get(roleId),

    addShopItem: (roleId, price, name, description) => {
        try {
            db.prepare('INSERT INTO shop_items (role_id, price, name, description, currency) VALUES (?, ?, ?, ?, ?)').run(roleId, price, name, description, DEFAULT_CURRENCY);
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
            return { success: false, message: `You do not have enough ${item.currency} to purchase this item.` };
        }

        db.prepare('UPDATE wallets SET balance = balance - ? WHERE user_id = ? AND currency = ?').run(item.price, userId, item.currency);
        return { success: true, price: item.price, currency: item.currency };
    },
};