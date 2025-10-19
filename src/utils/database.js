// src/utils/database.js
const path = require('node:path');
const Database = require('better-sqlite3');

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
CREATE TABLE IF NOT EXISTS manual_boosters ( guild_id TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY (guild_id, user_id) );
CREATE TABLE IF NOT EXISTS booster_perks ( guild_id TEXT NOT NULL, user_id TEXT NOT NULL, emoji TEXT NOT NULL, PRIMARY KEY (guild_id, user_id) );

-- New Tables for Feature Expansion --
CREATE TABLE IF NOT EXISTS daily_stats (
    guild_id TEXT NOT NULL,
    date TEXT NOT NULL,
    total_solyx_acquired REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, date),
    FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_stats (
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    total_solyx_from_messages REAL NOT NULL DEFAULT 0,
    total_solyx_from_vc REAL NOT NULL DEFAULT 0,
    total_vc_time_ms INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, guild_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
);
`;
db.exec(schema);

// --- Safe Migration to REAL data type for balances ---
const migrateBalancesToReal = db.transaction(() => {
    const tablesToMigrate = {
        wallets: 'balance',
        clan_wallets: 'balance',
        transactions: 'amount',
        shop_items: 'price'
    };

    let needsMigration = false;
    for (const tableName of Object.keys(tablesToMigrate)) {
        try {
            const tableInfo = db.pragma(`table_info(${tableName})`);
            const column = tableInfo.find(col => col.name === tablesToMigrate[tableName]);
            if (column && column.type.toUpperCase() !== 'REAL') {
                needsMigration = true;
                break;
            }
        } catch (e) { /* Table might not exist yet, which is fine */ }
    }

    if (!needsMigration) return;

    console.log('[Database Migration] INTEGER balance type detected. Beginning migration to REAL...');
    
    for (const [tableName, columnName] of Object.entries(tablesToMigrate)) {
        try {
            const tableInfo = db.pragma(`table_info(${tableName})`);
            if (!tableInfo.length) continue; // Skip if table doesn't exist

            const column = tableInfo.find(col => col.name === columnName);
            if (column && column.type.toUpperCase() === 'REAL') continue; // Skip if already migrated

            const originalSchema = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(tableName).sql;
            
            db.exec(`ALTER TABLE ${tableName} RENAME TO ${tableName}_old;`);
            const newSchema = originalSchema.replace(new RegExp(`(\`?${columnName}\`?)\s+INTEGER`, 'i'), `$1 REAL`);
            db.exec(newSchema);
            db.exec(`INSERT INTO ${tableName} SELECT * FROM ${tableName}_old;`);
            db.exec(`DROP TABLE ${tableName}_old;`);
            console.log(`[Database Migration] Successfully migrated ${tableName}.${columnName} to REAL.`);
        } catch(e) {
            console.error(`[Database Migration] Failed to migrate ${tableName}:`, e.message);
        }
    }
    console.log('[Database Migration] All balance columns migrated to REAL successfully.');
});

try {
    migrateBalancesToReal();
    console.log('[Database] Connected to SQLite and ensured schema is up-to-date.');
} catch (error) {
    console.error('[Database Migration] FAILED TO MIGRATE BALANCES TO REAL:', error);
    process.exit(1);
}

module.exports = db;