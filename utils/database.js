// utils/database.js
const path = require('node:path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'data', 'database.db');
const db = new Database(dbPath);

// Define the database schema
const schema = `
CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    balance INTEGER DEFAULT 0
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
`;

// Execute the schema to create tables if they don't exist
db.exec(schema);

console.log('[Database] Connected to SQLite and ensured schema exists.');

module.exports = db;