// utils/clanManager.js
const db = require('./database');

const MAX_MEMBERS = 100;
const MAX_OFFICERS = 8;
const MAX_VICE_GUILD_MASTERS = 4;

// Prepare statements for reuse (performance and security)
const queries = {
    findClanContainingUser: db.prepare('SELECT clan_id, authority FROM clan_members WHERE user_id = ?'),
    getClanMembersByAuth: db.prepare('SELECT user_id FROM clan_members WHERE clan_id = ? AND authority = ?'),
    getClanById: db.prepare('SELECT * FROM clans WHERE clan_id = ?'),
    getMemberCount: db.prepare('SELECT COUNT(*) as count FROM clan_members WHERE clan_id = ? AND authority = ?'),
    createClan: db.prepare('INSERT INTO clans (clan_id, owner_id) VALUES (?, ?)'),
    addClanMember: db.prepare('INSERT INTO clan_members (user_id, clan_id, authority) VALUES (?, ?, ?)'),
    addUser: db.prepare('INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)'),
    deleteClan: db.prepare('DELETE FROM clans WHERE clan_id = ?'),
    removeUserFromClan: db.prepare('DELETE FROM clan_members WHERE user_id = ? AND clan_id = ?'),
    setClanOwner: db.prepare('UPDATE clans SET owner_id = ? WHERE clan_id = ?'),
    updateMemberAuth: db.prepare('UPDATE clan_members SET authority = ? WHERE user_id = ? AND clan_id = ?'),
    setMotto: db.prepare('UPDATE clans SET motto = ? WHERE clan_id = ?'),
};

function findClanContainingUser(userId) {
    const row = queries.findClanContainingUser.get(userId);
    if (!row) return null;

    const clan = queries.getClanById.get(row.clan_id);
    if (!clan) return null;

    // To match the old structure, we fetch all members
    const members = queries.getClanMembersByAuth.all(clan.clan_id, 'Member').map(r => r.user_id);
    const officers = queries.getClanMembersByAuth.all(clan.clan_id, 'Officer').map(r => r.user_id);
    const viceGuildMasters = queries.getClanMembersByAuth.all(clan.clan_id, 'Vice Guild Master').map(r => r.user_id);

    return {
        clanRoleId: clan.clan_id,
        clanOwnerUserID: clan.owner_id,
        motto: clan.motto,
        members,
        officers,
        viceGuildMasters,
    };
}

module.exports = {
    MAX_MEMBERS,
    MAX_OFFICERS,
    MAX_VICE_GUILD_MASTERS,

    getClanData: (clanRoleId) => {
        const clan = queries.getClanById.get(clanRoleId);
        if (!clan) return null;

        const members = queries.getClanMembersByAuth.all(clan.clan_id, 'Member').map(r => r.user_id);
        const officers = queries.getClanMembersByAuth.all(clan.clan_id, 'Officer').map(r => r.user_id);
        const viceGuildMasters = queries.getClanMembersByAuth.all(clan.clan_id, 'Vice Guild Master').map(r => r.user_id);

        return {
            clanOwnerUserID: clan.owner_id,
            motto: clan.motto,
            members,
            officers,
            viceGuildMasters
        };
    },

    findClanByOwner: (ownerId) => {
        const row = db.prepare('SELECT * FROM clans WHERE owner_id = ?').get(ownerId);
        if (!row) return null;
        return findClanContainingUser(ownerId);
    },

    createClan: (clanRoleId, ownerId) => {
        try {
            queries.addUser.run(ownerId, 'Unknown');
            queries.createClan.run(clanRoleId, ownerId);
            queries.addClanMember.run(ownerId, clanRoleId, 'Owner');
            return { success: true };
        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
                return { success: false, message: 'This role is already registered as a clan.' };
            }
            console.error('[ClanManager] Error in createClan:', error);
            return { success: false, message: 'A database error occurred.' };
        }
    },

    deleteClan: (clanRoleId) => {
        queries.deleteClan.run(clanRoleId); // ON DELETE CASCADE will handle clan_members
        return { success: true };
    },

    addUserToClan: (clanRoleId, targetUserId, authority) => {
        try {
            // Check limits before adding
            const limit = authority === 'Member' ? MAX_MEMBERS : authority === 'Officer' ? MAX_OFFICERS : MAX_VICE_GUILD_MASTERS;
            const { count } = queries.getMemberCount.get(clanRoleId, authority);
            if (count >= limit) return { success: false, message: `This clan has reached the maximum number of ${authority}s.` };

            queries.addUser.run(targetUserId, 'Unknown');
            queries.addClanMember.run(targetUserId, clanRoleId, authority);
            return { success: true };
        } catch (error) {
            console.error('[ClanManager] Error in addUserToClan:', error);
            return { success: false, message: 'A database error occurred.' };
        }
    },

    removeUserFromClan: (clanRoleId, targetUserId) => {
        const result = queries.removeUserFromClan.run(targetUserId, clanRoleId);
        return { success: result.changes > 0, message: result.changes > 0 ? 'User removed.' : 'User not found in clan.' };
    },

    setClanOwner: (clanRoleId, newOwnerId) => {
        try {
            const oldOwner = queries.getClanById.get(clanRoleId).owner_id;
            // Transaction to ensure both steps succeed or fail together
            db.transaction(() => {
                queries.setClanOwner.run(newOwnerId, clanRoleId);
                // Remove new owner from any other authority in this clan
                queries.removeUserFromClan.run(newOwnerId, clanRoleId);
                queries.addClanMember.run(newOwnerId, clanRoleId, 'Owner');
                // Demote old owner to a regular member
                queries.updateMemberAuth.run('Member', oldOwner, clanRoleId);
            })();
            return { success: true };
        } catch (error) {
            console.error('[ClanManager] Error in setClanOwner:', error);
            return { success: false, message: 'A database error occurred during ownership transfer.' };
        }
    },

    manageClanMemberRole: (clanRoleId, targetUserId, newAuthority) => {
        try {
            // Check limits before promoting
            const limit = newAuthority === 'Member' ? MAX_MEMBERS : newAuthority === 'Officer' ? MAX_OFFICERS : MAX_VICE_GUILD_MASTERS;
            const { count } = queries.getMemberCount.get(clanRoleId, newAuthority);
            if (count >= limit) return { success: false, message: `This clan has reached the maximum number of ${newAuthority}s.` };

            queries.updateMemberAuth.run(newAuthority, targetUserId, clanRoleId);
            return { success: true };
        } catch (error) {
            console.error('[ClanManager] Error in manageClanMemberRole:', error);
            return { success: false, message: 'A database error occurred.' };
        }
    },

    setClanMotto: (clanRoleId, motto) => {
        try {
            queries.setMotto.run(motto, clanRoleId);
            return { success: true };
        } catch (error) {
            console.error('[ClanManager] Error in setClanMotto:', error);
            return { success: false, message: 'A database error occurred.' };
        }
    },

    // We now need to pass the user's username to the add user function
    // This is a simple wrapper around the main addUserToClan function
    addUserToClanAndEnsureRole: async (client, guild, clanRoleId, targetUserId, authority, discordRole) => {
        const guildMember = await guild.members.fetch(targetUserId).catch(() => null);
        if (guildMember) {
            db.prepare('INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)').run(targetUserId, guildMember.user.username);
        }

        const result = module.exports.addUserToClan(clanRoleId, targetUserId, authority);
        if (result.success && guildMember && discordRole) {
            if (!guildMember.roles.cache.has(discordRole.id)) {
                await guildMember.roles.add(discordRole).catch(e => console.error(e));
            }
        }
        return result;
    },

    findClanContainingUser,
};