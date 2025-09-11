// events/guildMemberUpdate.js
const { Events } = require('discord.js');
const clanManager = require('../utils/clanManager');
const config = require('../config');
const db = require('../utils/database'); // Import the database connection

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember, client /* config is passed by eventHandler */) {
        const guild = newMember.guild;
        if (guild.id !== config.guildID) return; // Only operate on configured guild

        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;

        // Ensure user exists in the database
        db.prepare('INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)').run(newMember.id, newMember.user.username);

        // Check if a clan role was ADDED
        for (const [roleId, role] of newRoles) {
            if (!oldRoles.has(roleId)) { // Role was added
                const clanData = clanManager.getClanData(roleId);
                if (clanData) { // This role is registered as a clan role
                    const existingUserAffiliation = clanManager.findClanContainingUser(newMember.id);
                    if (existingUserAffiliation) {
                        // User is already in a clan, either this one or another. We don't need to do anything.
                        continue;
                    }

                    // Add user to this clan as a 'Member'
                    console.log(`[guildMemberUpdate] Role ${role.name} added to ${newMember.user.tag}. Auto-enrolling as Member in clan ${roleId}.`);
                    clanManager.addUserToClan(roleId, newMember.id, 'Member');
                }
            }
        }

        // Check if a clan role was REMOVED
        for (const [roleId, role] of oldRoles) {
            if (!newRoles.has(roleId)) { // Role was removed
                const clanData = clanManager.getClanData(roleId);
                if (clanData) { // This was a registered clan role
                    if (clanData.clanOwnerUserID === newMember.id) {
                        console.warn(`[guildMemberUpdate] Clan Owner ${newMember.id} for clan ${roleId} had their role removed manually. Clan ownership needs admin review.`);
                        // Don't automatically remove owner from DB, needs admin action.
                    } else {
                        // Remove user from this clan's records
                        clanManager.removeUserFromClan(roleId, newMember.id);
                        console.log(`[guildMemberUpdate] Role ${role.name} removed from ${newMember.user.tag}. Removing from clan ${roleId} records.`);
                    }
                }
            }
        }
    },
};