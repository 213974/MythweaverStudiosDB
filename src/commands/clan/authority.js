// src/commands/clan/authority.js
const { EmbedBuilder } = require('discord.js');
const clanManager = require('../../managers/clanManager');

module.exports = {
    async execute(interaction, guildId, userClanData, permissions) {
        // --- Use editReply if a reply already exists, otherwise reply normally ---
        const replyOrEdit = async (options) => {
            if (interaction.replied || interaction.deferred) {
                return interaction.editReply(options);
            }
            return interaction.reply(options);
        };

        if (!permissions.isOwner && !permissions.isVice) {
            return replyOrEdit({ content: 'Only the Clan Owner or Vice Guild Masters can manage authority.', flags: 64 });
        }

        const targetUser = interaction.options.getUser('user');
        const newAuthority = interaction.options.getString('authority');

        if (targetUser.id === userClanData.clanOwnerUserID) {
            return replyOrEdit({ content: "The Clan Owner's authority cannot be changed with this command.", flags: 64 });
        }
        
        const targetUserClan = clanManager.findClanContainingUser(guildId, targetUser.id);
        if (!targetUserClan || targetUserClan.clanRoleId !== userClanData.clanRoleId) {
            return replyOrEdit({ content: `${targetUser} is not a member of your clan.`, flags: 64 });
        }

        if (newAuthority === 'Vice Guild Master' && !permissions.isOwner) {
            return replyOrEdit({ content: 'Only the Clan Owner can promote members to Vice Guild Master.', flags: 64 });
        }

        const result = clanManager.manageClanMemberRole(guildId, userClanData.clanRoleId, targetUser.id, newAuthority);

        if (result.success) {
            const embed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('✨ Clan Authority Updated ✨')
                .setDescription(`<@${targetUser.id}>'s authority has been updated to **${newAuthority}**.`);
            
            // For the dashboard flow, we want to clear components after success.
            await replyOrEdit({ embeds: [embed], components: [] });
        } else {
            await replyOrEdit({ content: `Failed to update authority: ${result.message}`, flags: 64 });
        }
    }
};