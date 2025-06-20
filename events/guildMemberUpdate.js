// events/guildMemberUpdate.js
const { Events } = require('discord.js');
const clanManager = require('../utils/clanManager');
const config = require('../src/config'); // Ensure config is available if needed by clanManager directly

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember, client /* config is passed by eventHandler */) {
        const guild = newMember.guild;
        if (guild.id !== config.guildID) return; // Only operate on configured guild

        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;

        // Check if a clan role was ADDED
        for (const [roleId, role] of newRoles) {
            if (!oldRoles.has(roleId)) { // Role was added
                const clanData = clanManager.getClanData(roleId);
                if (clanData) { // This role is registered as a clan role
                    // Check if user is already in ANY clan
                    const existingUserAffiliation = clanManager.findClanContainingUser(newMember.id);
                    if (existingUserAffiliation && existingUserAffiliation.clanRoleId !== roleId) {
                        console.log(`[guildMemberUpdate] User ${newMember.id} manually got role ${roleId} but is already in clan ${existingUserAffiliation.clanRoleId}. No automatic add.`);
                        // Optional: remove the newly added role if strict one-clan policy enforced automatically
                        // await newMember.roles.remove(roleId).catch(e => console.error(`Failed to auto-remove conflicting role: ${e}`));
                        continue; // Skip if in another clan
                    }
                    if (existingUserAffiliation && existingUserAffiliation.clanRoleId === roleId) {
                        console.log(`[guildMemberUpdate] User ${newMember.id} got role ${roleId} but is already in this clan's records. Ensuring role is present.`);
                        continue; // Already known to this clan
                    }


                    if (clanData.members.length >= clanManager.MAX_MEMBERS) {
                        console.log(`[guildMemberUpdate] Clan ${roleId} is full. Cannot auto-add ${newMember.id}.`);
                        // Optional: remove the role if clan is full
                        // await newMember.roles.remove(roleId).catch(e => console.error(`Failed to auto-remove role from full clan: ${e}`));
                        continue;
                    }

                    // Add user to this clan as a 'Member'
                    console.log(`[guildMemberUpdate] Role ${role.name} added to ${newMember.user.tag}. Auto-enrolling as Member in clan ${roleId}.`);
                    clanData.members.push(newMember.id);
                    // Ensure they are not in other lists if somehow they were
                    clanData.officers = clanData.officers.filter(id => id !== newMember.id);
                    clanData.viceGuildMasters = clanData.viceGuildMasters.filter(id => id !== newMember.id);

                    const clans = clanManager.getAllClans(); // Read all clans
                    clans[roleId] = clanData; // Update specific clan data
                    clanManager.saveClans(clans); // Save updated clans object

                    // Optional: DM user about auto-enrollment
                    // await newMember.send(`You have been automatically enrolled as a Member in the clan **${role.name}** because you received the role.`).catch(console.error);
                }
            }
        }

        // Check if a clan role was REMOVED
        for (const [roleId, role] of oldRoles) {
            if (!newRoles.has(roleId)) { // Role was removed
                const clanData = clanManager.getClanData(roleId);
                if (clanData) { // This was a registered clan role
                    // If user was owner, this shouldn't happen via manual role removal ideally, but handle it
                    if (clanData.clanOwnerUserID === newMember.id) {
                        console.warn(`[guildMemberUpdate] Clan Owner ${newMember.id} for clan ${roleId} had their role removed manually. Clan ownership needs admin review.`);
                        // Don't automatically remove owner from JSON, needs admin action.
                    } else {
                        // Remove user from this clan's lists
                        const initialMemberCount = clanData.members.length;
                        clanData.members = clanData.members.filter(id => id !== newMember.id);
                        clanData.officers = clanData.officers.filter(id => id !== newMember.id);
                        clanData.viceGuildMasters = clanData.viceGuildMasters.filter(id => id !== newMember.id);

                        if (clanData.members.length !== initialMemberCount ||
                            !clanData.officers.includes(newMember.id) || // Check if they were actually removed from lists
                            !clanData.viceGuildMasters.includes(newMember.id)) {

                            console.log(`[guildMemberUpdate] Role ${role.name} removed from ${newMember.user.tag}. Removing from clan ${roleId} records.`);
                            const clans = clanManager.getAllClans();
                            clans[roleId] = clanData;
                            clanManager.saveClans(clans);

                            // Optional: DM user about auto-removal
                            // await newMember.send(`You have been automatically removed from the clan **${role.name}** because your role was removed.`).catch(console.error);
                        }
                    }
                }
            }
        }
    },
};