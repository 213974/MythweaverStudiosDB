// src/utils/database.js
const path = require('node:path');
const Database = require('better-sqlite3');
const config = require('../config');

const dbPath = path.join(__dirname, '..', '..', 'data', 'database.db');
const db = new Database(dbPath);

// Multi-Server Schema (v3) - This is the definitive structure for the bot.
const schema = `
CREATE TABLE IF NOT EXISTS users ( user_id TEXT PRIMARY KEY, username TEXT NOT NULL, referred_by TEXT );
CREATE TABLE IF NOT EXISTS guilds ( guild_id TEXT PRIMARY KEY, name TEXT NOT NULL );
CREATE TABLE IF NOT EXISTS settings ( guild_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT, PRIMARY KEY (guild_id, key), FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE );
CREATE TABLE IF NOT EXISTS wallets ( user_id TEXT NOT NULL, guild_id TEXT NOT NULL, currency TEXT NOT NULL, balance INTEGER NOT NULL DEFAULT 10, capacity INTEGER NOT NULL DEFAULT 100000, PRIMARY KEY (user_id, guild_id, currency), FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE, FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE );
CREATE TABLE IF NOT EXISTS claims ( user_id TEXT NOT NULL, guild_id TEXT NOT NULL, claim_type TEXT NOT NULL, last_claimed_at TEXT NOT NULL, streak INTEGER NOT NULL DEFAULT 0, weekly_claim_state TEXT, PRIMARY KEY (user_id, guild_id, claim_type), FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE, FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE );
CREATE TABLE IF NOT EXISTS transactions ( transaction_id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, guild_id TEXT NOT NULL, amount INTEGER NOT NULL, reason TEXT NOT NULL, timestamp TEXT NOT NULL, moderator_id TEXT );
CREATE TABLE IF NOT EXISTS clans ( guild_id TEXT NOT NULL, clan_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, motto TEXT, FOREIGN KEY (owner_id) REFERENCES users(user_id), FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE );
CREATE TABLE IF NOT EXISTS clan_members ( user_id TEXT NOT NULL, clan_id TEXT NOT NULL, guild_id TEXT NOT NULL, authority TEXT NOT NULL, PRIMARY KEY (user_id, clan_id), FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE, FOREIGN KEY (clan_id) REFERENCES clans(clan_id) ON DELETE CASCADE );
CREATE TABLE IF NOT EXISTS clan_wallets ( clan_id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'Solyx™', balance INTEGER NOT NULL DEFAULT 0, FOREIGN KEY (clan_id) REFERENCES clans(clan_id) ON DELETE CASCADE );
CREATE TABLE IF NOT EXISTS shop_items ( guild_id TEXT NOT NULL, role_id TEXT NOT NULL, price INTEGER NOT NULL, name TEXT NOT NULL, description TEXT, currency TEXT DEFAULT 'Solyx™', PRIMARY KEY (guild_id, role_id), FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE );
CREATE TABLE IF NOT EXISTS raffles ( raffle_id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT, channel_id TEXT NOT NULL, message_id TEXT, ticket_cost INTEGER NOT NULL, max_tickets_user INTEGER, num_winners INTEGER NOT NULL DEFAULT 1, end_timestamp TEXT NOT NULL, status TEXT NOT NULL, winner_id TEXT );
CREATE TABLE IF NOT EXISTS raffle_entries ( entry_id INTEGER PRIMARY KEY AUTOINCREMENT, raffle_id INTEGER NOT NULL, user_id TEXT NOT NULL, FOREIGN KEY (raffle_id) REFERENCES raffles(raffle_id), FOREIGN KEY (user_id) REFERENCES users(user_id) );
`;
db.exec(schema);

// --- Automated Multi-Server Migration Script ---
const migrateToMultiGuild = db.transaction(() => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='guilds'").get();
    if (tables) return; // Migration already complete, exit.

    console.log('[Database Migration] Single-server schema detected. Beginning upgrade to multi-server support...');
    const defaultGuildId = config.guildID;
    if (!defaultGuildId) throw new Error("CRITICAL: config.guildID must be set to run the multi-server migration.");

    db.exec(`CREATE TABLE guilds (guild_id TEXT PRIMARY KEY, name TEXT NOT NULL);`);
    db.prepare('INSERT INTO guilds (guild_id, name) VALUES (?, ?)').run(defaultGuildId, 'Default Guild (Pre-Migration)');

    const tableMigrationPlan = [ 'settings', 'wallets', 'claims', 'transactions', 'clans', 'clan_members', 'clan_wallets', 'shop_items', 'raffles' ];
    
    for (const tableName of tableMigrationPlan) {
        // Check if the old table exists before trying to migrate it
        const oldTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(`${tableName}`);
        if (!oldTableExists) {
            console.log(`[Database Migration] Skipping table '${tableName}' as it does not exist in the old schema.`);
            continue;
        }

        const columns = db.pragma(`table_info(${tableName})`).map(col => col.name).join(', ');
        db.exec(`ALTER TABLE ${tableName} RENAME TO ${tableName}_old;`);
        
        const createStmt = schema.split(';').find(stmt => stmt.includes(`CREATE TABLE IF NOT EXISTS ${tableName}`));
        if (createStmt) db.exec(createStmt + ';');
        else throw new Error(`Could not find new schema for table ${tableName}`);

        db.exec(`INSERT INTO ${tableName} (guild_id, ${columns}) SELECT '${defaultGuildId}', ${columns} FROM ${tableName}_old;`);
        db.exec(`DROP TABLE ${tableName}_old;`);
        console.log(`[Database Migration] Successfully migrated table: ${tableName}`);
    }
    
    console.log('[Database Migration] Multi-server upgrade complete.');
});

try {
    migrateToMultiGuild();
    console.log('[Database] Connected to SQLite and ensured schema is up-to-date.');
} catch (error) {
    console.error('[Database] FAILED TO RUN MIGRATION:', error);
    process.exit(1);
}

module.exports = db;