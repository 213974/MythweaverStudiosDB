// src/utils/database.js
const path = require('node:path');
const Database = require('better-sqlite3');
const config = require('../config');

const dbPath = path.join(__dirname, '..', '..', 'data', 'database.db');
const db = new Database(dbPath);

const schema = `
CREATE TABLE IF NOT EXISTS users ( user_id TEXT PRIMARY KEY, username TEXT NOT NULL, referred_by TEXT );
CREATE TABLE IF NOT EXISTS guilds ( guild_id TEXT PRIMARY KEY, name TEXT NOT NULL );
CREATE TABLE IF NOT EXISTS settings ( guild_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT, PRIMARY KEY (guild_id, key), FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE );
CREATE TABLE IF NOT EXISTS wallets ( user_id TEXT NOT NULL, guild_id TEXT NOT NULL, currency TEXT NOT NULL, balance REAL NOT NULL DEFAULT 10, capacity INTEGER NOT NULL DEFAULT 100000, PRIMARY KEY (user_id, guild_id, currency), FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE, FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE );
CREATE TABLE IF NOT EXISTS claims ( user_id TEXT NOT NULL, guild_id TEXT NOT NULL, claim_type TEXT NOT NULL, last_claimed_at TEXT NOT NULL, streak INTEGER NOT NULL DEFAULT 0, weekly_claim_state TEXT, PRIMARY KEY (user_id, guild_id, claim_type), FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE, FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE );
CREATE TABLE IF NOT EXISTS transactions ( transaction_id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, guild_id TEXT NOT NULL, amount REAL NOT NULL, reason TEXT NOT NULL, timestamp TEXT NOT NULL, moderator_id TEXT );
CREATE TABLE IF NOT EXISTS clans ( guild_id TEXT NOT NULL, clan_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, motto TEXT, FOREIGN KEY (owner_id) REFERENCES users(user_id), FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE );
CREATE TABLE IF NOT EXISTS clan_members ( user_id TEXT NOT NULL, clan_id TEXT NOT NULL, guild_id TEXT NOT NULL, authority TEXT NOT NULL, PRIMARY KEY (user_id, clan_id), FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE, FOREIGN KEY (clan_id) REFERENCES clans(clan_id) ON DELETE CASCADE );
CREATE TABLE IF NOT EXISTS clan_wallets ( clan_id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'Solyx™', balance REAL NOT NULL DEFAULT 0, FOREIGN KEY (clan_id) REFERENCES clans(clan_id) ON DELETE CASCADE );
CREATE TABLE IF NOT EXISTS shop_items ( guild_id TEXT NOT NULL, role_id TEXT NOT NULL, price REAL NOT NULL, name TEXT NOT NULL, description TEXT, currency TEXT DEFAULT 'Solyx™', PRIMARY KEY (guild_id, role_id), FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE );
CREATE TABLE IF NOT EXISTS raffles ( raffle_id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT, channel_id TEXT NOT NULL, message_id TEXT, ticket_cost INTEGER NOT NULL, max_tickets_user INTEGER, num_winners INTEGER NOT NULL DEFAULT 1, end_timestamp TEXT NOT NULL, status TEXT NOT NULL, winner_id TEXT );
CREATE TABLE IF NOT EXISTS raffle_entries ( entry_id INTEGER PRIMARY KEY AUTOINCREMENT, raffle_id INTEGER NOT NULL, user_id TEXT NOT NULL, FOREIGN KEY (raffle_id) REFERENCES raffles(raffle_id), FOREIGN KEY (user_id) REFERENCES users(user_id) );
`;
db.exec(schema);

// --- THIS IS THE FIX: Safe Migration to REAL data type for balances ---
const migrateBalancesToReal = db.transaction(() => {
    const walletInfo = db.pragma('table_info(wallets)');
    const balanceColumn = walletInfo.find(col => col.name === 'balance');
    if (balanceColumn && balanceColumn.type === 'REAL') {
        return; // Migration already complete
    }

    console.log('[Database Migration] INTEGER balance type detected. Beginning migration to REAL...');
    const tablesToMigrate = {
        wallets: 'balance',
        clan_wallets: 'balance',
        transactions: 'amount',
        shop_items: 'price'
    };

    const tableSchemas = {};
    for (const tableName in tablesToMigrate) {
        const result = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(tableName);
        if (result) {
            tableSchemas[tableName] = result.sql;
        }
    }

    for (const [tableName, columnName] of Object.entries(tablesToMigrate)) {
        if (!tableSchemas[tableName]) {
            console.log(`[Database Migration] Table ${tableName} not found, skipping.`);
            continue;
        }
        db.exec(`ALTER TABLE ${tableName} RENAME TO ${tableName}_old;`);
        const originalSchema = tableSchemas[tableName];
        const newSchema = originalSchema.replace(new RegExp(`(\`?${columnName}\`?)\s+INTEGER`, 'i'), `$1 REAL`);
        db.exec(newSchema);
        db.exec(`INSERT INTO ${tableName} SELECT * FROM ${tableName}_old;`);
        db.exec(`DROP TABLE ${tableName}_old;`);
        console.log(`[Database Migration] Successfully migrated ${tableName}.${columnName} to REAL.`);
    }
    console.log('[Database Migration] All balance columns migrated to REAL successfully.');
});

try {
    migrateBalancesToReal();
} catch (error) {
    console.error('[Database Migration] FAILED TO MIGRATE BALANCES TO REAL:', error);
    process.exit(1);
}

try {
    const raffleColumns = db.pragma(`table_info(raffles)`).map(col => col.name);
    if (!raffleColumns.includes('image_url')) {
        console.log('[Database Migration] Adding image_url column to raffles table.');
        db.exec('ALTER TABLE raffles ADD COLUMN image_url TEXT');
    }
} catch (err) {
    if (!err.message.includes('no such table')) {
        console.error('[Database Migration] Error applying additive migration:', err);
    }
}

console.log('[Database] Connected to SQLite and ensured schema is up-to-date.');
module.exports = db;