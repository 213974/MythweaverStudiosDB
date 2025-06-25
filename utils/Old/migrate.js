// utils/migrate.js
// A ONE-TIME SCRIPT to migrate data from clans.json to the new SQLite database.
const fs = require('node:fs');
const path = require('node:path');
const db = require('./database'); // This will connect to and initialize the DB

const clansFilePath = path.join(__dirname, '..', 'data', 'clans.json');

function migrate() {
    console.log('Starting migration from clans.json to SQLite...');

    // Check if clans.json exists
    if (!fs.existsSync(clansFilePath)) {
        console.log('clans.json not found. No migration needed.');
        return;
    }

    const clansData = JSON.parse(fs.readFileSync(clansFilePath, 'utf8'));
    const clanIds = Object.keys(clansData);

    if (clanIds.length === 0) {
        console.log('clans.json is empty. No migration needed.');
        return;
    }

    // Prepare SQL statements for insertion
    const insertUser = db.prepare('INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)');
    const insertClan = db.prepare('INSERT OR IGNORE INTO clans (clan_id, owner_id, motto) VALUES (?, ?, ?)');
    const insertClanMember = db.prepare('INSERT OR IGNORE INTO clan_members (user_id, clan_id, authority) VALUES (?, ?, ?)');

    // Use a transaction for performance and data integrity
    const migrateTransaction = db.transaction(() => {
        for (const clanId of clanIds) {
            const clan = clansData[clanId];
            console.log(`Migrating clan: ${clanId}`);

            // --- FIX: Step 1: Gather ALL users from this clan ---
            const allUserIds = new Set();
            allUserIds.add(clan.clanOwnerUserID);
            (clan.viceGuildMasters || []).forEach(id => allUserIds.add(id));
            (clan.officers || []).forEach(id => allUserIds.add(id));
            (clan.members || []).forEach(id => allUserIds.add(id));

            // --- FIX: Step 2: Insert all users into the users table FIRST ---
            for (const userId of allUserIds) {
                // We don't have their username here, so we'll use a placeholder.
                // The bot can update this later when it sees the user.
                insertUser.run(userId, 'UnknownUsername');
            }

            // --- Step 3: Now it's safe to insert the clan ---
            insertClan.run(clanId, clan.clanOwnerUserID, clan.motto || null);

            // --- Step 4: Now it's safe to insert all the member records ---
            // Owner
            insertClanMember.run(clan.clanOwnerUserID, clanId, 'Owner');

            // Vice Guild Masters
            for (const userId of (clan.viceGuildMasters || [])) {
                insertClanMember.run(userId, clanId, 'Vice Guild Master');
            }

            // Officers
            for (const userId of (clan.officers || [])) {
                insertClanMember.run(userId, clanId, 'Officer');
            }

            // Members
            for (const userId of (clan.members || [])) {
                insertClanMember.run(userId, clanId, 'Member');
            }
        }
    });

    try {
        migrateTransaction();
        console.log('Migration successful!');
        // Optional: Rename clans.json to prevent re-running
        fs.renameSync(clansFilePath, path.join(__dirname, '..', 'data', 'clans.json.migrated'));
        console.log('Renamed clans.json to clans.json.migrated to prevent accidental re-migration.');
    } catch (err) {
        console.error('Migration failed:', err.message);
    }
}

// Run the migration
migrate();