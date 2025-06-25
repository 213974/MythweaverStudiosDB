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
    bank_capacity INTEGER DEFAULT 1000,
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

// --- Migration Logic for existing databases ---
// This is complex, so we'll handle it carefully.
// This assumes you previously had a `balance` and `last_daily_claim` column on the `users` table.
try {
    const transaction = db.transaction(() => {
        // Check if the old balance column exists
        const oldColumns = db.pragma('table_info(users)').map(col => col.name);
        if (oldColumns.includes('balance')) {
            console.log('[Database Migration] Old `balance` column found. Migrating data to `wallets` table...');
            const usersWithBalance = db.prepare('SELECT user_id, balance FROM users WHERE balance > 0').all();

            const insertWallet = db.prepare('INSERT OR IGNORE INTO wallets (user_id, currency, balance) VALUES (?, ?, ?)');
            for (const user of usersWithBalance) {
                insertWallet.run(user.user_id, 'Gold', user.balance);
            }
            console.log(`[Database Migration] Migrated ${usersWithBalance.length} user balances.`);

            // Now, we'll create a new users table and copy data, effectively dropping the old columns
            db.exec(`
                CREATE TABLE IF NOT EXISTS users_new (
                    user_id TEXT PRIMARY KEY,
                    username TEXT NOT NULL
                );
                INSERT INTO users_new (user_id, username) SELECT user_id, username FROM users;
                DROP TABLE users;
                ALTER TABLE users_new RENAME TO users;
            `);
            console.log('[Database Migration] Restructured `users` table successfully.');
        }
    });
    transaction();
} catch (error) {
    if (!error.message.includes("no such column: balance")) {
        console.error('[Database Migration] Failed to migrate old columns:', error);
    }
}


console.log('[Database] Connected to SQLite and ensured schema exists.');

module.exports = db;