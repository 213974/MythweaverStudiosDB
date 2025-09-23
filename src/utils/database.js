// utils/database.js
const path = require('node:path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', '..', 'data', 'database.db');
const db = new Database(dbPath);

// --- V2 Schema Definition ---
// This schema reflects the new single-wallet system and includes all GDD features.
const schema = `
CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    referred_by TEXT,
    FOREIGN KEY (referred_by) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS clans (
    clan_id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    motto TEXT,
    FOREIGN KEY (owner_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS clan_members (
    user_id TEXT NOT NULL,
    clan_id TEXT NOT NULL,
    authority TEXT NOT NULL,
    PRIMARY KEY (user_id, clan_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (clan_id) REFERENCES clans(clan_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clan_wallets (
    clan_id TEXT PRIMARY KEY,
    currency TEXT NOT NULL DEFAULT 'Solyx™',
    balance INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (clan_id) REFERENCES clans(clan_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS shop_items (
    role_id TEXT PRIMARY KEY,
    price INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    currency TEXT DEFAULT 'Solyx™'
);

CREATE TABLE IF NOT EXISTS wallets (
    user_id TEXT NOT NULL,
    currency TEXT NOT NULL,
    balance INTEGER NOT NULL DEFAULT 10,
    capacity INTEGER NOT NULL DEFAULT 100000,
    tier INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, currency),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS claims (
    user_id TEXT NOT NULL,
    claim_type TEXT NOT NULL,
    last_claimed_at TEXT NOT NULL,
    streak INTEGER NOT NULL DEFAULT 0,
    weekly_claim_state TEXT,
    PRIMARY KEY (user_id, claim_type),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
    transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    moderator_id TEXT,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS raffles (
    raffle_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    ticket_cost INTEGER NOT NULL,
    max_tickets_user INTEGER,
    end_timestamp TEXT NOT NULL,
    status TEXT NOT NULL,
    winner_id TEXT
);

CREATE TABLE IF NOT EXISTS raffle_entries (
    entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
    raffle_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    FOREIGN KEY (raffle_id) REFERENCES raffles(raffle_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);
`;

// Execute the schema to ensure all tables exist.
db.exec(schema);

// --- Automated Migration Logic ---
// This runs on every startup but only performs actions if needed.
const migrate = db.transaction(() => {
    // Migration 1: Merge the old dual-wallet system into the new single-wallet system.
    const walletColumns = db.pragma('table_info(wallets)').map(col => col.name);
    if (walletColumns.includes('bank') && walletColumns.includes('sanctuary_balance')) {
        console.log("[Database Migration] Old 'wallets' table detected. Beginning migration to single-balance system...");

        // 1. Create a new table with the correct V2 schema.
        db.exec(`
            CREATE TABLE IF NOT EXISTS wallets_new (
                user_id TEXT NOT NULL,
                currency TEXT NOT NULL,
                balance INTEGER NOT NULL DEFAULT 10,
                capacity INTEGER NOT NULL DEFAULT 100000,
                tier INTEGER NOT NULL DEFAULT 1,
                PRIMARY KEY (user_id, currency),
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            );
        `);

        // 2. Copy and merge data from the old table into the new one.
        // We add `bank` and `balance` (Sanctuary) together into the new `balance` column.
        db.exec(`
            INSERT INTO wallets_new (user_id, currency, balance, capacity, tier)
            SELECT user_id, currency, (bank + balance), bank_capacity, bank_tier FROM wallets;
        `);

        // 3. Drop old table, rename new one.
        db.exec('DROP TABLE wallets;');
        db.exec('ALTER TABLE wallets_new RENAME TO wallets;');
        console.log("[Database Migration] 'wallets' table successfully migrated.");
    }

    // Migration 2: Add 'streak' column to 'claims' table if it doesn't exist.
    const claimsColumns = db.pragma('table_info(claims)').map(col => col.name);
    if (!claimsColumns.includes('streak')) {
        console.log("[Database Migration] Adding 'streak' column to 'claims' table.");
        db.prepare('ALTER TABLE claims ADD COLUMN streak INTEGER NOT NULL DEFAULT 0').run();
    }

    // Migration 3: Add 'referred_by' column to 'users' table if it doesn't exist.
    const userColumns = db.pragma('table_info(users)').map(col => col.name);
    if (!userColumns.includes('referred_by')) {
        console.log("[Database Migration] Adding 'referred_by' column to 'users' table.");
        db.prepare('ALTER TABLE users ADD COLUMN referred_by TEXT').run();
    }
});

try {
    migrate();
    console.log('[Database] Connected to SQLite and ensured schema is up-to-date.');
} catch (error) {
    console.error('[Database] FAILED TO RUN MIGRATIONS:', error);
}


module.exports = db;