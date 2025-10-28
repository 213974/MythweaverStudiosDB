// src/managers/economy/walletManager.js
const db = require('../../utils/database');
const { format } = require('date-fns');

const DEFAULT_CURRENCY = 'Solyx™';
const DEFAULT_WALLET_CAPACITY = 100000;

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

module.exports = {
    DEFAULT_CURRENCY,

    modifySolyx: (userId, guildId, amount, reason, moderatorId = null) => {
        if (amount === 0) return { success: false };
        ensureWallet(userId, guildId);
        try {
            const result = db.transaction(() => {
                db.prepare('UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND guild_id = ? AND currency = ?').run(amount, userId, guildId, DEFAULT_CURRENCY);
                db.prepare('INSERT INTO transactions (user_id, guild_id, amount, reason, timestamp, moderator_id) VALUES (?, ?, ?, ?, ?, ?)')
                  .run(userId, guildId, amount, reason, new Date().toISOString(), moderatorId);
                
                if (amount > 0 && !moderatorId) {
                    const today = format(new Date(), 'yyyy-MM-dd');
                    db.prepare('INSERT INTO daily_stats (guild_id, date, total_solyx_acquired) VALUES (?, ?, ?) ON CONFLICT(guild_id, date) DO UPDATE SET total_solyx_acquired = total_solyx_acquired + excluded.total_solyx_acquired').run(guildId, today, amount);
                }
                
                const wallet = db.prepare('SELECT balance FROM wallets WHERE user_id = ? AND guild_id = ? AND currency = ?').get(userId, guildId, DEFAULT_CURRENCY);
                return wallet;
            })();
            return { success: true, newBalance: result.balance };
        } catch (error) {
            console.error(`[modifySolyx] Failed to modify Solyx™ for ${userId} in ${guildId}:`, error);
            return { success: false };
        }
    },

    getWallet: (userId, guildId, currency = DEFAULT_CURRENCY) => {
        ensureWallet(userId, guildId, currency);
        return db.prepare('SELECT * FROM wallets WHERE user_id = ? AND guild_id = ? AND currency = ?').get(userId, guildId, currency);
    },
    
    getConsolidatedBalance: (userId, guildId) => {
        const wallet = module.exports.getWallet(userId, guildId, DEFAULT_CURRENCY);
        return wallet ? wallet.balance : 0;
    },

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
    
    getTopUsers: (guildId, limit = 25) => {
        return db.prepare(`
            SELECT user_id, balance 
            FROM wallets 
            WHERE guild_id = ? AND currency = ?
            ORDER BY balance DESC 
            LIMIT ?
        `).all(guildId, DEFAULT_CURRENCY, limit);
    },

    getUserRank: (userId, guildId) => {
        const allUsers = db.prepare(`
            SELECT user_id, balance 
            FROM wallets 
            WHERE guild_id = ? AND currency = ?
            ORDER BY balance DESC
        `).all(guildId, DEFAULT_CURRENCY);
        
        const rank = allUsers.findIndex(user => user.user_id === userId) + 1;
        
        if (rank === 0) return null;
        return { rank, balance: allUsers[rank - 1].balance };
    },
};