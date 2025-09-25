// src/commands/clan/leave.js
const clanManager = require('../../utils/clanManager');

module.exports = {
    async execute(interaction, guildId, userClanData) {
        if (!userClanData) {
            return interaction.reply({ content: "You are not in a clan in this server.", flags: 64 });
        }
        if (userClanData.clanOwnerUserID === interaction.user.id) {
            return interaction.reply({ content: "Clan Owners cannot leave their clan.", flags: 64 });
        }

        const clanRole = await interaction.guild.roles.fetch(userClanData.clanRoleId).catch(() => null);
        if (!clanRole) {
            return interaction.reply({ content: "Error: Your clan's Discord role could not be found.", flags: 64 });
        }

        const leaveResult = clanManager.removeUserFromClan(guildId, userClanData.clanRoleId, interaction.user.id);

        if (leaveResult.success) {
            const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
            if (member) {
                await member.roles.remove(clanRole).catch(e => console.error(`Failed to remove role on leave: ${e.message}`));
            }
            return interaction.reply({ content: `You have successfully left **${clanRole.name}**.` });
        } else {
            return interaction.reply({ content: `Failed to leave clan: ${leaveResult.message}`, flags: 64 });
        }
    }
};