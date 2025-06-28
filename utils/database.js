// utils/database.js
const path = require('node:path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'data', 'database.db');
const db = new Database(dbPath);

// Define the database schema
const schema = `
CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL
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

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS shop_items (
    role_id TEXT PRIMARY KEY,
    price INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    currency TEXT DEFAULT 'Gold'
);

CREATE TABLE IF NOT EXISTS wallets (
    user_id TEXT NOT NULL,
    currency TEXT NOT NULL,
    balance INTEGER DEFAULT 0,
    bank INTEGER DEFAULT 0,
    bank_capacity INTEGER DEFAULT 100000,
    bank_tier INTEGER DEFAULT 1,
    sanctuary_balance INTEGER DEFAULT 0,
    sanctuary_capacity INTEGER DEFAULT 1000,
    PRIMARY KEY (user_id, currency),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS claims (
    user_id TEXT NOT NULL,
    claim_type TEXT NOT NULL,
    last_claimed_at TEXT NOT NULL,
    weekly_claim_state TEXT,
    PRIMARY KEY (user_id, claim_type),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
`;

db.exec(schema);

// --- Migration/Alteration Logic ---
try {
    const columns = db.pragma('table_info(wallets)').map(col => col.name);
    if (!columns.includes('bank_tier')) {
        console.log("[Database] 'bank_tier' column not found. Adding it to 'wallets' table.");
        db.prepare("ALTER TABLE wallets ADD COLUMN bank_tier INTEGER DEFAULT 1").run();
    }
    if (!columns.includes('sanctuary_balance')) {
        console.log("[Database] 'sanctuary_balance' column not found. Adding it to 'wallets' table.");
        db.prepare("ALTER TABLE wallets ADD COLUMN sanctuary_balance INTEGER DEFAULT 0").run();
    }
    if (!columns.includes('sanctuary_capacity')) {
        console.log("[Database] 'sanctuary_capacity' column not found. Adding it to 'wallets' table.");
        db.prepare("ALTER TABLE wallets ADD COLUMN sanctuary_capacity INTEGER DEFAULT 1000").run();
    }
} catch (e) {
    console.error("[Database] Failed to run wallet migrations:", e);
}


console.log('[Database] Connected to SQLite and ensured schema exists.');

module.exports = db;