// src/events/guildMemberUpdate.js
const { Events } = require('discord.js');
const clanManager = require('../managers/clanManager');

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember) {
        const guildId = newMember.guild.id;
        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;

        // --- ROLE ADDED ---
        // Find a role that exists in the new set but not the old one.
        const addedRole = newRoles.find(role => !oldRoles.has(role.id));
        if (addedRole) {
            const isClanRole = clanManager.getClanData(guildId, addedRole.id);
            if (isClanRole) {
                const userClan = clanManager.findClanContainingUser(guildId, newMember.id);
                // If this is a clan role AND the user isn't already in this clan's DB, add them.
                if (!userClan || userClan.clanRoleId !== addedRole.id) {
                    clanManager.addUserToClan(guildId, addedRole.id, newMember.id, 'Member');
                    console.log(`[Role Sync] User ${newMember.user.tag} was given the '${addedRole.name}' role and has been auto-enrolled as a Member.`);
                }
            }
        }

        // --- ROLE REMOVED ---
        // Find a role that exists in the old set but not the new one.
        const removedRole = oldRoles.find(role => !newRoles.has(role.id));
        if (removedRole) {
            const isClanRole = clanManager.getClanData(guildId, removedRole.id);
            if (isClanRole) {
                const userClan = clanManager.findClanContainingUser(guildId, newMember.id);
                // Proceed only if the user was actually in this clan's DB.
                if (userClan && userClan.clanRoleId === removedRole.id) {
                    const memberDbRecord = db.prepare('SELECT authority FROM clan_members WHERE user_id = ? AND clan_id = ?').get(newMember.id, removedRole.id);
                    const authority = memberDbRecord?.authority;

                    if (authority === 'Member') {
                        // If they were just a member, remove them from the database.
                        clanManager.removeUserFromClan(guildId, removedRole.id, newMember.id);
                        console.log(`[Role Sync] Member ${newMember.user.tag} had the '${removedRole.name}' role removed and has been unenrolled from the clan.`);
                    } else if (authority === 'Officer' || authority === 'Vice Guild Master' || authority === 'Owner') {
                        // If they are leadership, protect them by re-adding the role.
                        try {
                            await newMember.roles.add(removedRole, 'Leadership role protection: Re-applied removed clan role.');
                            console.log(`[Role Sync] Leadership member ${newMember.user.tag} had the '${removedRole.name}' role removed. The role has been automatically re-applied.`);
                        } catch (error) {
                            console.error(`[Role Sync] FAILED to re-apply protected role '${removedRole.name}' to ${newMember.user.tag}:`, error);
                        }
                    }
                }
            }
        }
    },
};