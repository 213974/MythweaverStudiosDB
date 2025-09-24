// src/commands/clan/authority.js
const { EmbedBuilder } = require('discord.js');
const clanManager = require('../../utils/clanManager');

module.exports = {
    async execute(interaction, guildId, userClanData, permissions) {
        if (!permissions.isOwner && !permissions.isVice) {
            return interaction.reply({ content: 'Only the Clan Owner or Vice Guild Masters can manage authority.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('user');
        const newAuthority = interaction.options.getString('authority');

        if (targetUser.id === userClanData.clanOwnerUserID) {
            return interaction.reply({ content: "The Clan Owner's authority cannot be changed with this command.", ephemeral: true });
        }
        
        const targetUserClan = clanManager.findClanContainingUser(guildId, targetUser.id);
        if (!targetUserClan || targetUserClan.clanRoleId !== userClanData.clanRoleId) {
            return interaction.reply({ content: `${targetUser} is not a member of your clan.`, ephemeral: true });
        }

        if (newAuthority === 'Vice Guild Master' && !permissions.isOwner) {
            return interaction.reply({ content: 'Only the Clan Owner can promote members to Vice Guild Master.', ephemeral: true });
        }

        const result = clanManager.manageClanMemberRole(guildId, userClanData.clanRoleId, targetUser.id, newAuthority);

        if (result.success) {
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('✨ Clan Authority Updated ✨')
                .setDescription(`${targetUser}'s authority has been updated to **${newAuthority}**.`);
            await interaction.reply({ embeds: [embed] });
        } else {
            await interaction.reply({ content: `Failed to update authority: ${result.message}`, ephemeral: true });
        }
    }
};