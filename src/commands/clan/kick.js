// src/commands/clan/kick.js
const { EmbedBuilder } = require('discord.js');
const clanManager = require('../../utils/clanManager');
const db = require('../../utils/database');

module.exports = {
    async execute(interaction, guildId, userClanData, permissions) {
        if (!permissions.isOwner && !permissions.isVice && !permissions.isOfficer) {
            return interaction.reply({ content: 'You do not have the required authority to kick members.', ephemeral: true });
        }

        const targetUserToKick = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided.';

        if (targetUserToKick.id === interaction.user.id) return interaction.reply({ content: "You cannot kick yourself.", ephemeral: true });

        const targetUserClan = clanManager.findClanContainingUser(guildId, targetUserToKick.id);
        if (!targetUserClan || targetUserClan.clanRoleId !== userClanData.clanRoleId) {
            return interaction.reply({ content: `${targetUserToKick.username} is not in your clan.`, ephemeral: true });
        }
        
        const targetUserAuth = db.prepare('SELECT authority FROM clan_members WHERE guild_id = ? AND user_id = ?').get(guildId, targetUserToKick.id)?.authority;
        if (!targetUserAuth) return interaction.reply({ content: 'Could not verify the target member\'s authority.', ephemeral: true });

        if (targetUserAuth === 'Owner') return interaction.reply({ content: "The Owner cannot be kicked.", ephemeral: true });
        if (targetUserAuth === 'Vice Guild Master' && !permissions.isOwner) return interaction.reply({ content: 'Only the Owner can kick a Vice Guild Master.', ephemeral: true });
        if (targetUserAuth === 'Officer' && !permissions.isOwner && !permissions.isVice) return interaction.reply({ content: 'Only the Owner or a Vice Guild Master can kick an Officer.', ephemeral: true });
        
        const removeResult = clanManager.removeUserFromClan(guildId, userClanData.clanRoleId, targetUserToKick.id);
        if (removeResult.success) {
            const targetMember = await interaction.guild.members.fetch(targetUserToKick.id).catch(() => null);
            const clanDiscordRole = await interaction.guild.roles.fetch(userClanData.clanRoleId);
            if (targetMember) await targetMember.roles.remove(clanDiscordRole).catch(() => {});

            const embed = new EmbedBuilder().setColor('#ff0000').setTitle('🛡️ Clan Member Kicked 🛡️').setDescription(`${targetUserToKick} has been kicked from **${clanDiscordRole.name}**.`).addFields({ name: 'Kicked By', value: `${interaction.user}` }, { name: 'Reason', value: reason });
            await interaction.reply({ embeds: [embed] });
        } else {
            return interaction.reply({ content: `Failed to kick member: ${removeResult.message}`, ephemeral: true });
        }
    }
};