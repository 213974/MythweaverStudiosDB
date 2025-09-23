// src/commands/clan/subcommands/invite.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const clanManager = require('../../../utils/clanManager');
const { formatTimestamp } = require('../../../utils/timestampFormatter');

module.exports = {
    async execute(interaction, userClanData, permissions) {
        if (!permissions.isOwner && !permissions.isVice) {
            return interaction.reply({ content: 'Only Clan Owners or Vice Guild Masters can invite members.', ephemeral: true });
        }
        if (!userClanData) { // Should not happen if permissions are true, but a good safeguard
            return interaction.reply({ content: 'Could not find your clan data to send an invite.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('user');
        const newAuthority = interaction.options.getString('authority');

        if (targetUser.bot) return interaction.reply({ content: "Bots cannot be invited to clans.", ephemeral: true });
        if (targetUser.id === interaction.user.id) return interaction.reply({ content: "You cannot invite yourself.", ephemeral: true });

        if (newAuthority === 'Vice Guild Master' && !permissions.isOwner) {
            return interaction.reply({ content: 'Only the Clan Owner can invite members directly as Vice Guild Master.', ephemeral: true });
        }

        const targetUserAnyClan = clanManager.findClanContainingUser(targetUser.id);
        if (targetUserAnyClan) {
            return interaction.reply({ content: `${targetUser.username} is already in another clan. They must leave first.`, ephemeral: true });
        }
        
        const clanDiscordRole = await interaction.guild.roles.fetch(userClanData.clanRoleId);
        const inviteTimestamp = Math.floor(Date.now() / 1000) + 300; // 5 minute expiry

        const inviteEmbed = new EmbedBuilder()
            .setColor(clanDiscordRole.color || '#0099ff')
            .setTitle(`⚔️ Clan Invitation: ${clanDiscordRole.name} ⚔️`)
            .setDescription(`${interaction.user} has invited you to join **${clanDiscordRole.name}** as a **${newAuthority}**.`)
            .addFields({ name: 'Expires', value: formatTimestamp(inviteTimestamp, 'R') });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`clan_accept_${userClanData.clanRoleId}_${targetUser.id}_${newAuthority.replace(/\s+/g, '-')}`).setLabel('Accept').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`clan_deny_${userClanData.clanRoleId}_${targetUser.id}`).setLabel('Deny').setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({
            content: `${targetUser}`,
            embeds: [inviteEmbed],
            components: [row]
        });
    }
};