// src/commands/clan/subcommands/motto.js
const clanManager = require('../../../utils/clanManager');

module.exports = {
    async execute(interaction, userClanData, permissions) {
        if (!permissions.isOwner) {
            return interaction.reply({ content: 'Only the Clan Owner can manage the clan motto.', flags: 64 });
        }

        const motto = interaction.options.getString('motto') || null;
        const result = clanManager.setClanMotto(userClanData.clanRoleId, motto);

        if (result.success) {
            if (motto) await interaction.reply({ content: `Your clan motto has been updated to: *“${motto}”*`, flags: 64 });
            else await interaction.reply({ content: `Your clan motto has been removed.`, flags: 64 });
        } else {
            await interaction.reply({ content: `Failed to set motto: ${result.message}`, flags: 64 });
        }
    }
};