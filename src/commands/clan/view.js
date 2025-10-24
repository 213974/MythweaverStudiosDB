// src/commands/clan/view.js
const { EmbedBuilder } = require('discord.js');
const clanManager = require('../../managers/clanManager');
const db = require('../../utils/database');
const config = require('../../config');

/**
 * Creates a formatted string for a list of member IDs, fetching their data for proper mentions.
 * @param {import('discord.js').Guild} guild The guild to fetch members from.
 * @param {string[]} memberIds An array of user IDs.
 * @param {number} [displayLimit=40] The maximum number of members to display.
 * @returns {Promise<string>} A formatted string of member mentions.
 */
async function formatMemberList(guild, memberIds, displayLimit = 40) {
    if (!memberIds || memberIds.length === 0) {
        return 'None';
    }

    const membersToDisplay = memberIds.slice(0, displayLimit);
    let membersMap;
    try {
        membersMap = await guild.members.fetch({ user: membersToDisplay });
    } catch (e) {
        console.warn('[Clan View] Could not fetch all members for list, some may be missing from the server.');
        membersMap = new Map();
    }
    
    const memberList = membersToDisplay.map(id => {
        const member = membersMap.get(id);
        return member ? member.toString() : `<@${id}>`; // Fallback to mention if member not fetched
    }).join(', ');

    if (memberIds.length > displayLimit) {
        return `${memberList} ...and ${memberIds.length - displayLimit} more.`;
    }
    return memberList;
}

module.exports = {
    async execute(interaction, guildId, userClanData) {
        const specifiedRole = interaction.options.getRole('clanrole');
        let clanToViewData;
        let clanToViewRole;

        if (specifiedRole) {
            clanToViewData = clanManager.getClanData(guildId, specifiedRole.id);
            if (!clanToViewData) return interaction.reply({ content: `**${specifiedRole.name}** is not a registered clan in this server.`, flags: 64 });
            clanToViewRole = specifiedRole;
        } else {
            if (!userClanData) return interaction.reply({ content: "You are not in a clan. Specify a clan role to view its details.", flags: 64 });
            clanToViewData = userClanData;
            clanToViewRole = await interaction.guild.roles.fetch(userClanData.clanRoleId).catch(() => null);
            if (!clanToViewRole) return interaction.reply({ content: "Could not find your clan's Discord role.", flags: 64 });
        }

        // --- PERMISSION & PRIVACY LOGIC ---
        const member = interaction.member;
        const adminRoleId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'admin_role_id'").get(guildId)?.value;
        const raffleRoleId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'raffle_creator_role_id'").get(guildId)?.value;

        const hasElevatedPerms = 
            config.ownerIDs.includes(member.id) ||
            (adminRoleId && member.roles.cache.has(adminRoleId)) ||
            (raffleRoleId && member.roles.cache.has(raffleRoleId)) ||
            (clanToViewData && member.id === clanToViewData.clanOwnerUserID) ||
            (clanToViewData && (clanToViewData.viceGuildMasters || []).includes(member.id));
        
        // A view is ephemeral if the user is viewing their own clan (no role specified) OR they don't have elevated perms.
        const isViewingOwnClan = !specifiedRole;
        const isEphemeral = isViewingOwnClan || !hasElevatedPerms;

        await interaction.deferReply({ flags: isEphemeral ? 64 : 0 });

        const { clanOwnerUserID, motto, viceGuildMasters = [], officers = [], members = [] } = clanToViewData;
        
        // --- Asynchronously format all member lists ---
        const [vgmList, officerList, memberList] = await Promise.all([
            formatMemberList(interaction.guild, viceGuildMasters),
            formatMemberList(interaction.guild, officers),
            formatMemberList(interaction.guild, members, 40)
        ]);
        
        const ownerMember = await interaction.guild.members.fetch(clanOwnerUserID).catch(() => null);
        const ownerDisplay = ownerMember ? ownerMember.toString() : `<@${clanOwnerUserID}>`;

        const embed = new EmbedBuilder()
            .setColor(clanToViewRole.color || '#FFFFFF')
            .setTitle(`${clanToViewRole.name}`)
            .addFields(
                { name: '👑 Owner', value: ownerDisplay },
                { name: `🛡️ Vice Guild Masters (${viceGuildMasters.length}/${clanManager.MAX_VICE_GUILD_MASTERS})`, value: vgmList },
                { name: `⚔️ Officers (${officers.length}/${clanManager.MAX_OFFICERS})`, value: officerList },
                { name: `👥 Members (${members.length}/${clanManager.MAX_MEMBERS})`, value: memberList }
            )
            .setTimestamp()
            .setFooter({ text: `Clan Role ID: ${clanToViewRole.id}` });
            
        if (motto) {
            embed.setDescription(`*“${motto}”*`);
        }

        await interaction.editReply({ embeds: [embed] });
    }
};