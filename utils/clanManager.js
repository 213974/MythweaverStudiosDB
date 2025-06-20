// utils/clanManager.js
const fs = require('node:fs');
const path = require('node:path');
const clansFilePath = path.join(__dirname, '..', 'data', 'clans.json');
const config = require('../src/config');

const MAX_MEMBERS = 100;
const MAX_OFFICERS = 8;
const MAX_VICE_GUILD_MASTERS = 4;

function readClans() {
    try {
        if (!fs.existsSync(clansFilePath)) {
            fs.writeFileSync(clansFilePath, JSON.stringify({}), 'utf8');
            return {};
        }
        const data = fs.readFileSync(clansFilePath, 'utf8');
        if (data.trim() === '') {
            fs.writeFileSync(clansFilePath, JSON.stringify({}), 'utf8');
            return {};
        }
        return JSON.parse(data);
    } catch (error) {
        console.error('[ClanManager] Error reading or parsing clans.json:', error);
        try {
            fs.writeFileSync(clansFilePath, JSON.stringify({}), 'utf8');
            console.log('[ClanManager] clans.json was corrupted or unreadable, reset to {}.');
        } catch (resetError) {
            console.error('[ClanManager] CRITICAL: Failed to reset corrupted clans.json:', resetError);
        }
        return {};
    }
}

function saveClans(clans) {
    try {
        fs.writeFileSync(clansFilePath, JSON.stringify(clans, null, 4), 'utf8');
    } catch (error) {
        console.error('[ClanManager] Error writing to clans.json:', error);
    }
}

async function getGuild(client, interactionOrGuildIdOrGuildObject) {
    // If it's already a guild object
    if (interactionOrGuildIdOrGuildObject && interactionOrGuildIdOrGuildObject.roles && interactionOrGuildIdOrGuildObject.id) {
        return interactionOrGuildIdOrGuildObject;
    }

    // If it's an interaction object with a guild property
    if (interactionOrGuildIdOrGuildObject && interactionOrGuildIdOrGuildObject.guild) {
        return interactionOrGuildIdOrGuildObject.guild;
    }

    // If it's a guild ID string, or if we need to use the default from config
    const guildIdToFetch = (typeof interactionOrGuildIdOrGuildObject === 'string')
        ? interactionOrGuildIdOrGuildObject
        : config.guildID;

    if (!client || !guildIdToFetch) {
        console.error("[ClanManager] getGuild: Client or Guild ID is missing for fetching.");
        return null;
    }

    try {
        const guild = await client.guilds.fetch(guildIdToFetch);
        return guild;
    } catch (error) {
        console.error(`[ClanManager] getGuild: Failed to fetch guild with ID ${guildIdToFetch}:`, error);
        return null;
    }
}

module.exports = {
    MAX_MEMBERS,
    MAX_OFFICERS,
    MAX_VICE_GUILD_MASTERS,

    getClanData: (clanRoleId) => {
        const clans = readClans();
        return clans[clanRoleId] || null;
    },

    getAllClans: () => {
        return readClans();
    },

    saveClans: saveClans,

    deleteClan: async (clanRoleId) => {
        const clans = readClans();
        if (!clans[clanRoleId]) {
            return { success: false, message: 'Clan not found in records.' };
        }

        const clanData = clans[clanRoleId];
        const ownerId = clanData.clanOwnerUserID;

        delete clans[clanRoleId];
        saveClans(clans);

        return { success: true, ownerId: ownerId, message: 'Clan successfully removed from records.' };
    },

    findClanByOwner: (ownerId) => {
        const clans = readClans();
        for (const roleId in clans) {
            if (clans[roleId].clanOwnerUserID === ownerId) {
                return { clanRoleId: roleId, ...clans[roleId] };
            }
        }
        return null;
    },

    findClanContainingUser: (userId) => {
        const clans = readClans();
        for (const clanRoleId in clans) {
            const clan = clans[clanRoleId];
            if (!clan) continue;
            if (clan.clanOwnerUserID === userId ||
                (clan.members && clan.members.includes(userId)) ||
                (clan.officers && clan.officers.includes(userId)) ||
                (clan.viceGuildMasters && clan.viceGuildMasters.includes(userId))) {
                return { clanRoleId, ...clan };
            }
        }
        return null;
    },

    createClan: async (client, guildContext, clanRoleId, ownerId) => {
        const guild = await getGuild(client, guildContext); // Use the refined getGuild
        if (!guild) return { success: false, message: "Internal error: Could not establish guild context for creating clan." };

        const clans = readClans();
        if (clans[clanRoleId]) {
            return { success: false, message: 'This role is already registered as a clan.' };
        }

        clans[clanRoleId] = {
            clanOwnerUserID: ownerId,
            members: [],
            officers: [],
            viceGuildMasters: [],
        };
        let autoEnrolledCount = 0;
        // Guild is already fetched and validated by getGuild above
        const clanRole = await guild.roles.fetch(clanRoleId).catch(() => null);
        if (clanRole) {
            await guild.members.fetch(); // Ensure member cache for the specific guild
            for (const member of guild.members.cache.values()) {
                if (member.id === ownerId) continue;
                if (member.roles.cache.has(clanRoleId)) {
                    const existingAffiliation = module.exports.findClanContainingUser(member.id);
                    if (!existingAffiliation) {
                        if (clans[clanRoleId].members.length < MAX_MEMBERS) {
                            clans[clanRoleId].members.push(member.id);
                            autoEnrolledCount++;
                        }
                    }
                }
            }
        }
        saveClans(clans);
        return { success: true, message: 'Clan created successfully.', autoEnrolledCount };
    },

    setClanOwner: async (client, guildContext, clanRoleId, newOwnerId) => {
        const guild = await getGuild(client, guildContext);
        if (!guild) return { success: false, message: "Internal error: Could not establish guild context for setting owner." };

        const clans = readClans();
        const clan = clans[clanRoleId];
        if (!clan) return { success: false, message: 'Clan not found for this role.' };

        const ownerExistingClan = module.exports.findClanContainingUser(newOwnerId);
        if (ownerExistingClan && ownerExistingClan.clanRoleId !== clanRoleId) {
            const otherClanRole = await guild.roles.fetch(ownerExistingClan.clanRoleId).catch(() => null);
            return { success: false, message: `Proposed new owner is already in ${otherClanRole?.name || 'another clan'}.` };
        }

        clan.clanOwnerUserID = newOwnerId;
        clan.members = (clan.members || []).filter(id => id !== newOwnerId);
        clan.officers = (clan.officers || []).filter(id => id !== newOwnerId);
        clan.viceGuildMasters = (clan.viceGuildMasters || []).filter(id => id !== newOwnerId);
        saveClans(clans);
        return { success: true, message: 'Clan owner updated.' };
    },

    addUserToClan: async (client, guildContext, clanRoleId, targetUserId, authority, discordRole) => {
        const guild = await getGuild(client, guildContext);
        if (!guild) {
            console.error("[ClanManager] addUserToClan: Failed to get guild.");
            return { success: false, message: 'Internal error: Could not determine guild.' };
        }

        const clans = readClans();
        const clan = clans[clanRoleId];
        if (!clan) return { success: false, message: 'Clan data not found.' };

        const existingClanAffiliation = module.exports.findClanContainingUser(targetUserId);
        if (existingClanAffiliation) {
            const otherClanRole = await guild.roles.fetch(existingClanAffiliation.clanRoleId).catch(() => null);
            return { success: false, message: `User is already a member of ${existingClanAffiliation.clanRoleId === clanRoleId ? 'this clan' : (otherClanRole?.name || 'another clan')}.` };
        }

        clan.members = clan.members || [];
        clan.officers = clan.officers || [];
        // viceGuildMasters is handled by manageClanMemberRole for additions

        switch (authority.toLowerCase()) {
            case 'member':
                if (clan.members.length >= MAX_MEMBERS) return { success: false, message: 'Clan has reached the maximum number of Members.' };
                clan.members.push(targetUserId);
                break;
            case 'officer':
                if (clan.officers.length >= MAX_OFFICERS) return { success: false, message: 'Clan has reached the maximum number of Officers.' };
                clan.officers.push(targetUserId);
                break;
            case 'vice guild master': // Should not be directly added via invite accept, only promoted by owner
                return { success: false, message: 'Vice Guild Master role must be assigned via promotion by the Clan Owner.' };
            default:
                return { success: false, message: 'Invalid authority level specified for a new member.' };
        }
        saveClans(clans);

        try {
            const member = await guild.members.fetch(targetUserId).catch(() => null);
            if (member && discordRole && !member.roles.cache.has(discordRole.id)) {
                await member.roles.add(discordRole);
            }
        } catch (error) {
            console.error(`[ClanManager] Failed to add Discord role ${discordRole?.id} to user ${targetUserId}:`, error);
        }
        return { success: true, message: `User successfully invited and added as ${authority}.` };
    },

    manageClanMemberRole: async (client, guildContext, clanRoleId, targetUserId, newAuthority, actingUserId) => {
        const guild = await getGuild(client, guildContext);
        if (!guild) {
            console.error("[ClanManager] manageClanMemberRole: Failed to get guild.");
            return { success: false, message: 'Internal error: Could not determine guild.' };
        }
        const clans = readClans();
        const clan = clans[clanRoleId];
        if (!clan) return { success: false, message: 'Clan data not found.' };

        const targetIsOwner = clan.clanOwnerUserID === targetUserId;
        if (targetIsOwner) return { success: false, message: "The Clan Owner's role cannot be managed this way." };

        const actorIsOwner = clan.clanOwnerUserID === actingUserId;
        const actorIsVice = (clan.viceGuildMasters || []).includes(actingUserId);

        if (newAuthority.toLowerCase() === 'vice guild master') {
            if (!actorIsOwner) return { success: false, message: 'Only the Clan Owner can promote to Vice Guild Master.' };
        } else if (newAuthority.toLowerCase() === 'officer') {
            if (!actorIsOwner && !actorIsVice) return { success: false, message: 'Only Clan Owners or Vice Guild Masters can manage Officer roles.' };
        } else if (newAuthority.toLowerCase() === 'member') { // Demoting to member
            if (!actorIsOwner && !actorIsVice) return { success: false, message: 'Only Clan Owners or Vice Guild Masters can manage Member roles.' };
        } else {
            return { success: false, message: 'Invalid new authority level.' };
        }

        clan.members = (clan.members || []).filter(id => id !== targetUserId);
        clan.officers = (clan.officers || []).filter(id => id !== targetUserId);
        clan.viceGuildMasters = (clan.viceGuildMasters || []).filter(id => id !== targetUserId);

        clan.members = clan.members || []; // Ensure arrays exist
        clan.officers = clan.officers || [];
        clan.viceGuildMasters = clan.viceGuildMasters || [];

        switch (newAuthority.toLowerCase()) {
            case 'member':
                if (clan.members.length >= MAX_MEMBERS) return { success: false, message: 'Clan has reached the maximum number of Members.' };
                clan.members.push(targetUserId);
                break;
            case 'officer':
                if (clan.officers.length >= MAX_OFFICERS) return { success: false, message: 'Clan has reached the maximum number of Officers.' };
                clan.officers.push(targetUserId);
                break;
            case 'vice guild master':
                if (clan.viceGuildMasters.length >= MAX_VICE_GUILD_MASTERS) return { success: false, message: 'Clan has reached the maximum number of Vice Guild Masters.' };
                clan.viceGuildMasters.push(targetUserId);
                break;
        }
        saveClans(clans);

        try {
            const member = await guild.members.fetch(targetUserId).catch(() => null);
            const discordRole = await guild.roles.fetch(clanRoleId).catch(() => null);
            if (member && discordRole && !member.roles.cache.has(discordRole.id)) {
                await member.roles.add(discordRole);
            }
        } catch (error) {
            console.error(`[ClanManager] Error ensuring role for ${targetUserId} during promotion:`, error);
        }
        return { success: true, message: `User's authority successfully changed to ${newAuthority}.` };
    },

    removeUserFromClan: async (client, guildContext, clanRoleId, targetUserId, discordRoleToManage) => {
        const guild = await getGuild(client, guildContext);
        if (!guild) {
            console.error("[ClanManager] removeUserFromClan: Failed to get guild.");
            return { success: false, message: 'Internal error: Could not determine guild.' };
        }
        const clans = readClans();
        const clan = clans[clanRoleId];
        if (!clan) return { success: false, message: 'Clan not found.' };

        if (clan.clanOwnerUserID === targetUserId) {
            return { success: false, message: "The Clan Owner cannot be removed this way." };
        }

        let removedFromJson = false;
        const initialMemberCount = clan.members ? clan.members.length : 0;
        const initialOfficerCount = clan.officers ? clan.officers.length : 0;
        const initialViceCount = clan.viceGuildMasters ? clan.viceGuildMasters.length : 0;

        clan.members = (clan.members || []).filter(id => id !== targetUserId);
        clan.officers = (clan.officers || []).filter(id => id !== targetUserId);
        clan.viceGuildMasters = (clan.viceGuildMasters || []).filter(id => id !== targetUserId);

        if ((clan.members && clan.members.length !== initialMemberCount) ||
            (clan.officers && clan.officers.length !== initialOfficerCount) ||
            (clan.viceGuildMasters && clan.viceGuildMasters.length !== initialViceCount)) {
            removedFromJson = true;
        }

        if (removedFromJson) {
            saveClans(clans);
            try {
                const member = await guild.members.fetch(targetUserId).catch(() => null);
                if (member && discordRoleToManage && member.roles.cache.has(discordRoleToManage.id)) {
                    await member.roles.remove(discordRoleToManage);
                }
            } catch (error) {
                console.error(`[ClanManager] Failed to remove Discord role ${discordRoleToManage?.id} from user ${targetUserId}:`, error);
            }
            return { success: true, message: 'User removed from clan and their clan role has been removed.' };
        }
        return { success: false, message: 'User not found in this clan with a removable role.' };
    },
};