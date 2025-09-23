// src/commands/clan/subcommands/leave.js
const clanManager = require('../../../utils/clanManager');

module.exports = {
    async execute(interaction, userClanData) {
        if (!userClanData) {
            return interaction.reply({ content: "You are not in any clan.", ephemeral: true });
        }
        if (userClanData.clanOwnerUserID === interaction.user.id) {
            return interaction.reply({ content: "Clan Owners cannot leave their clan. You must transfer ownership or have the clan disbanded by an admin.", ephemeral: true });
        }

        const clanRole = await interaction.guild.roles.fetch(userClanData.clanRoleId).catch(() => null);
        if (!clanRole) {
            return interaction.reply({ content: "Error: Your clan's Discord role could not be found.", ephemeral: true });
        }

        const leaveResult = clanManager.removeUserFromClan(userClanData.clanRoleId, interaction.user.id);

        if (leaveResult.success) {
            const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
            if (member) {
                await member.roles.remove(clanRole).catch(e => console.error(`Failed to remove role on leave: ${e.message}`));
            }
            return interaction.reply({ content: `You have successfully left **${clanRole.name}**.` });
        } else {
            return interaction.reply({ content: `Failed to leave clan: ${leaveResult.message}`, ephemeral: true });
        }
    }
};