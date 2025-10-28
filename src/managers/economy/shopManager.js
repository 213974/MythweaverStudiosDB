// src/managers/economy/shopManager.js
const db = require('../../utils/database');
const walletManager = require('./walletManager');

module.exports = {
    getShopItems: (guildId) => db.prepare('SELECT * FROM shop_items WHERE guild_id = ? ORDER BY price ASC').all(guildId),
    
    getShopItem: (roleId, guildId) => db.prepare('SELECT * FROM shop_items WHERE role_id = ? AND guild_id = ?').get(roleId, guildId),

    addShopItem: (roleId, guildId, price, name, description) => {
        try {
            db.prepare('INSERT INTO shop_items (role_id, guild_id, price, name, description, currency) VALUES (?, ?, ?, ?, ?, ?)').run(roleId, guildId, price, name, description, walletManager.DEFAULT_CURRENCY);
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
        const wallet = walletManager.getWallet(userId, guildId, item.currency);
        if (wallet.balance < item.price) return { success: false, message: `You do not have enough ${item.currency}.` };
        
        walletManager.modifySolyx(userId, guildId, -item.price, `Purchase: ${item.name}`);

        return { success: true, price: item.price, currency: item.currency };
    },
};