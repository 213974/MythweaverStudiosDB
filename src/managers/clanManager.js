// src/managers/clanManager.js
const db = require('../utils/database');

const MAX_MEMBERS = 100;
const MAX_OFFICERS = 8;
const MAX_VICE_GUILD_MASTERS = 4;

module.exports = {
    MAX_MEMBERS, MAX_OFFICERS, MAX_VICE_GUILD_MASTERS,

    /**
     * Retrieves all registered clans in a guild.
     * @param {string} guildId The guild ID.
     * @returns {Array<object>} A list of clan records.
     */
    getAllClans: (guildId) => {
        return db.prepare('SELECT clan_id, owner_id FROM clans WHERE guild_id = ?').all(guildId);
    },

    getClanData: (guildId, clanRoleId) => {
        const clan = db.prepare('SELECT * FROM clans WHERE guild_id = ? AND clan_id = ?').get(guildId, clanRoleId);
        if (!clan) return null;

        const members = db.prepare('SELECT user_id FROM clan_members WHERE guild_id = ? AND clan_id = ? AND authority = ?').all(guildId, clanRoleId, 'Member').map(r => r.user_id);
        const officers = db.prepare('SELECT user_id FROM clan_members WHERE guild_id = ? AND clan_id = ? AND authority = ?').all(guildId, clanRoleId, 'Officer').map(r => r.user_id);
        const viceGuildMasters = db.prepare('SELECT user_id FROM clan_members WHERE guild_id = ? AND clan_id = ? AND authority = ?').all(guildId, clanRoleId, 'Vice Guild Master').map(r => r.user_id);
        
        return {
            clanOwnerUserID: clan.owner_id,
            motto: clan.motto,
            guildhallChannelId: clan.guildhall_channel_id,
            members,
            officers,
            viceGuildMasters
        };
    },
    
    findClanContainingUser: (guildId, userId) => {
        const row = db.prepare('SELECT clan_id FROM clan_members WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
        if (!row) return null;

        const clanData = module.exports.getClanData(guildId, row.clan_id);
        if (!clanData) return null;

        return { clanRoleId: row.clan_id, ...clanData };
    },

    createClan: (guildId, clanRoleId, ownerId) => {
        try {
            db.transaction(() => {
                db.prepare('INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)').run(ownerId, 'Unknown');
                db.prepare('INSERT INTO clans (guild_id, clan_id, owner_id) VALUES (?, ?, ?)').run(guildId, clanRoleId, ownerId);
                db.prepare('INSERT INTO clan_members (guild_id, user_id, clan_id, authority) VALUES (?, ?, ?, ?)').run(guildId, ownerId, clanRoleId, 'Owner');
            })();
            return { success: true };
        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
                return { success: false, message: 'This role is already registered as a clan in this server.' };
            }
            console.error('[ClanManager] Error creating clan:', error);
            return { success: false, message: 'A database error occurred.' };
        }
    },
    
    deleteClan: (guildId, clanRoleId) => {
        const result = db.prepare('DELETE FROM clans WHERE guild_id = ? AND clan_id = ?').run(guildId, clanRoleId);
        return { success: result.changes > 0 };
    },

    addUserToClan: (guildId, clanRoleId, targetUserId, authority) => {
        const getMemberCount = (auth) => db.prepare('SELECT COUNT(*) as count FROM clan_members WHERE guild_id = ? AND clan_id = ? AND authority = ?').get(guildId, clanRoleId, auth).count;

        const limit = authority === 'Member' ? MAX_MEMBERS : authority === 'Officer' ? MAX_OFFICERS : MAX_VICE_GUILD_MASTERS;
        if (getMemberCount(authority) >= limit) {
            return { success: false, message: `This clan has reached the maximum number of ${authority}s.` };
        }

        try {
            db.prepare('INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)').run(targetUserId, 'Unknown');
            db.prepare('INSERT INTO clan_members (guild_id, user_id, clan_id, authority) VALUES (?, ?, ?, ?)').run(guildId, targetUserId, clanRoleId, authority);
            return { success: true };
        } catch (error) {
            console.error('[ClanManager] Error adding user to clan:', error);
            return { success: false, message: 'A database error occurred. The user may already be in this clan.' };
        }
    },
    
    removeUserFromClan: (guildId, clanRoleId, targetUserId) => {
        const result = db.prepare('DELETE FROM clan_members WHERE guild_id = ? AND clan_id = ? AND user_id = ?').run(guildId, clanRoleId, targetUserId);
        return { success: result.changes > 0 };
    },

    setClanOwner: (guildId, clanRoleId, newOwnerId) => {
        try {
            const clan = db.prepare('SELECT owner_id FROM clans WHERE guild_id = ? AND clan_id = ?').get(guildId, clanRoleId);
            if (!clan) return { success: false, message: 'Clan not found.' };
            const oldOwnerId = clan.owner_id;

            db.transaction(() => {
                db.prepare('UPDATE clans SET owner_id = ? WHERE guild_id = ? AND clan_id = ?').run(newOwnerId, guildId, clanRoleId);
                db.prepare('DELETE FROM clan_members WHERE guild_id = ? AND user_id = ?').run(guildId, newOwnerId); // Remove new owner from any other position in any clan in this guild
                db.prepare('INSERT INTO clan_members (guild_id, user_id, clan_id, authority) VALUES (?, ?, ?, ?)').run(guildId, newOwnerId, clanRoleId, 'Owner');
                db.prepare('UPDATE clan_members SET authority = ? WHERE guild_id = ? AND clan_id = ? AND user_id = ?').run('Member', guildId, clanRoleId, oldOwnerId);
            })();
            return { success: true };
        } catch (error) {
            console.error('[ClanManager] Error setting clan owner:', error);
            return { success: false, message: 'A database error occurred during ownership transfer.' };
        }
    },

    manageClanMemberRole: (guildId, clanRoleId, targetUserId, newAuthority) => {
        const result = db.prepare('UPDATE clan_members SET authority = ? WHERE guild_id = ? AND user_id = ? AND clan_id = ?').run(newAuthority, guildId, targetUserId, clanRoleId);
        return { success: result.changes > 0 };
    },

    getClanOwnedByUser: (guildId, userId) => {
        return db.prepare('SELECT clan_id FROM clans WHERE guild_id = ? AND owner_id = ?').get(guildId, userId);
    },

    setClanMotto: (guildId, clanRoleId, motto) => {
        const result = db.prepare('UPDATE clans SET motto = ? WHERE guild_id = ? AND clan_id = ?').run(motto, guildId, clanRoleId);
        return { success: result.changes > 0 };
    },

    /**
     * Updates a clan's record with its dedicated guildhall channel ID.
     * @param {string} guildId The ID of the guild.
     * @param {string} clanId The ID of the clan role.
     * @param {string} channelId The ID of the guildhall text channel.
     * @returns {{success: boolean}}
     */
    setClanGuildhallChannelId: (guildId, clanId, channelId) => {
        const result = db.prepare('UPDATE clans SET guildhall_channel_id = ? WHERE guild_id = ? AND clan_id = ?')
            .run(channelId, guildId, clanId);
        return { success: result.changes > 0 };
    },

    addUserToClanAndEnsureRole: async (guild, clanRoleId, targetUserId, authority, discordRole) => {
        const guildMember = await guild.members.fetch(targetUserId).catch(() => null);
        if (guildMember) {
            db.prepare('INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)').run(targetUserId, guildMember.user.username);
        }
        const result = module.exports.addUserToClan(guild.id, clanRoleId, targetUserId, authority);
        if (result.success && guildMember && discordRole) {
            if (!guildMember.roles.cache.has(discordRole.id)) {
                await guildMember.roles.add(discordRole).catch(e => console.error(e));
            }
        }
        return result;
    },
};