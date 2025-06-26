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
    db.prepare("SELECT last_daily_claim FROM users LIMIT 1").get();
} catch (error) {
    if (error.message.includes("no such column: last_daily_claim")) {
        console.log("[Database] 'last_daily_claim' column not found. Adding it to 'users' table.");
        db.prepare("ALTER TABLE users ADD COLUMN last_daily_claim TEXT").run();
    }
}

// Update old bank capacities to the new default
try {
    const updateStmt = db.prepare('UPDATE wallets SET bank_capacity = 100000 WHERE bank_capacity < 100000');
    const result = updateStmt.run();
    if (result.changes > 0) {
        console.log(`[Database] Updated ${result.changes} wallets to the new bank capacity of 100,000.`);
    }
} catch (e) {
    console.error("[Database] Failed to run bank capacity migration:", e);
}


console.log('[Database] Connected to SQLite and ensured schema exists.');

module.exports = db;