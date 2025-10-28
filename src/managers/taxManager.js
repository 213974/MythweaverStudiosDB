// src/managers/taxManager.js
const db = require('../utils/database');
const walletManager = require('./economy/walletManager');

// --- Constants ---
const DEFAULT_TAX_QUOTA = 100;
const MINIMUM_CONTRIBUTION = 10;
const TAX_PERIOD_DAYS = 30;

// --- Helper Functions ---

/**
 * Retrieves a specific system setting from the database.
 * @param {string} guildId The guild ID.
 * @param {string} key The setting key.
 * @returns {string|null} The setting value or null.
 */
function getSetting(guildId, key) {
    return db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = ?").get(guildId, key)?.value || null;
}

/**
 * Sets a specific system setting in the database.
 * @param {string} guildId The guild ID.
 * @param {string} key The setting key.
 * @param {string} value The setting value.
 */
function setSetting(guildId, key, value) {
    db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, ?, ?)").run(guildId, key, value);
}

// --- Core Module ---

module.exports = {
    TAX_PERIOD_DAYS,
    MINIMUM_CONTRIBUTION,

    /**
     * Retrieves the current tax quota for a guild.
     * @param {string} guildId The guild ID.
     * @returns {number} The tax quota.
     */
    getTaxQuota: (guildId) => {
        const quota = getSetting(guildId, 'system_tax_quota');
        return quota ? parseInt(quota, 10) : DEFAULT_TAX_QUOTA;
    },

    /**
     * Sets the tax quota for a guild.
     * @param {string} guildId The guild ID.
     * @param {number} amount The new quota amount.
     */
    setTaxQuota: (guildId, amount) => {
        setSetting(guildId, 'system_tax_quota', amount.toString());
    },

    /**
     * Retrieves the configured Guildhall category ID for a guild.
     * @param {string} guildId The guild ID.
     * @returns {string|null} The category ID.
     */
    getGuildhallCategoryId: (guildId) => {
        return getSetting(guildId, 'system_guildhall_category_id');
    },

    /**
     * Sets the Guildhall category ID for a guild.
     * @param {string} guildId The guild ID.
     * @param {string} categoryId The new category ID.
     */
    setGuildhallCategoryId: (guildId, categoryId) => {
        setSetting(guildId, 'system_guildhall_category_id', categoryId);
    },

    /**
     * Retrieves the tax status for a specific clan, creating a default record if one doesn't exist.
     * @param {string} guildId The guild ID.
     * @param {string} clanId The clan's role ID.
     * @returns {object} The clan's tax status.
     */
    getTaxStatus: (guildId, clanId) => {
        let status = db.prepare('SELECT * FROM clan_taxes WHERE guild_id = ? AND clan_id = ?').get(guildId, clanId);
        if (!status) {
            const now = new Date().toISOString();
            db.prepare('INSERT INTO clan_taxes (guild_id, clan_id, last_reset_timestamp) VALUES (?, ?, ?)').run(guildId, clanId, now);
            status = {
                clan_id: clanId,
                guild_id: guildId,
                amount_contributed: 0,
                last_contributor_id: null,
                last_reset_timestamp: now
            };
        }
        return status;
    },

    /**
     * Processes a Solyx contribution from a user to their clan's tax coffer.
     * @param {string} guildId The guild ID.
     * @param {string} clanId The clan's role ID.
     * @param {string} userId The contributing user's ID.
     * @param {number} amount The amount to contribute.
     * @returns {{success: boolean, message: string, newBalance?: number}} The result of the operation.
     */
    contributeSolyx: (guildId, clanId, userId, amount) => {
        if (amount < MINIMUM_CONTRIBUTION) {
            return { success: false, message: `Contribution must be at least ${MINIMUM_CONTRIBUTION} Solyx™.` };
        }

        const wallet = walletManager.getWallet(userId, guildId);

        if (Number(wallet.balance) < Number(amount)) {
            return { success: false, message: 'You do not have enough Solyx™ to make this contribution.' };
        }

        try {
            let newBalance;
            db.transaction(() => {
                const result = walletManager.modifySolyx(userId, guildId, -amount, `Clan Tax Contribution: ${clanId}`);
                if (result.success) {
                    newBalance = result.newBalance;
                } else {
                    // If modifySolyx fails for some reason, throw an error to roll back the transaction
                    throw new Error('Failed to modify user Solyx balance.');
                }

                db.prepare(`
                    UPDATE clan_taxes 
                    SET 
                        amount_contributed = amount_contributed + ?,
                        last_contributor_id = ?
                    WHERE guild_id = ? AND clan_id = ?
                `).run(amount, userId, guildId, clanId);
            })();
            // --- Return the new balance on success ---
            return { success: true, message: `Successfully contributed ${amount.toLocaleString()} Solyx™.`, newBalance };
        } catch (error) {
            console.error('[TaxManager] Failed to contribute Solyx:', error);
            return { success: false, message: 'A database error occurred during the contribution.' };
        }
    },

    /**
     * Resets a clan's tax period, clearing contributions and updating the timestamp.
     * @param {string} guildId The guild ID.
     * @param {string} clanId The clan's role ID.
     */
    resetTaxPeriod: (guildId, clanId) => {
        const now = new Date().toISOString();
        db.prepare(`
            UPDATE clan_taxes
            SET
                amount_contributed = 0,
                last_contributor_id = NULL,
                last_reset_timestamp = ?
            WHERE guild_id = ? AND clan_id = ?
        `).run(now, guildId, clanId);
        console.log(`[TaxManager] Reset tax period for clan ${clanId} in guild ${guildId}.`);
    },

    /**
     * Retrieves all registered clans in a guild.
     * @param {string} guildId The guild ID.
     * @returns {Array<object>} A list of clan records.
     */
    getAllClans: (guildId) => {
        return db.prepare('SELECT clan_id, owner_id FROM clans WHERE guild_id = ?').all(guildId);
    }
};