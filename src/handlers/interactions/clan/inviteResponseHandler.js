// src/handlers/interactions/clan/inviteResponseHandler.js
const { EmbedBuilder, ActionRowBuilder } = require('discord.js');
const clanManager = require('../../../utils/clanManager');

module.exports = async (interaction) => {
    const parts = interaction.customId.split('_');
    if (parts[0] !== 'clan' || (parts[1] !== 'accept' && parts[1] !== 'deny')) return;

    const invitedUserId = parts[3];
    if (interaction.user.id !== invitedUserId) {
        return interaction.reply({ content: "This invitation is not for you.", flags: 64 });
    }

    const originalMessage = interaction.message;
    const disabledRow = ActionRowBuilder.from(originalMessage.components[0]);
    disabledRow.components.forEach(component => component.setDisabled(true));
    await interaction.update({ components: [disabledRow] });

    const action = parts[1];
    const clanRoleId = parts[2];

    const updatedEmbed = EmbedBuilder.from(originalMessage.embeds[0]);
    updatedEmbed.setFields([]); // Clear "Expires" field

    if (action === 'accept') {
        const authorityToAssign = parts[4].replace(/-/g, ' ');
        const clanDiscordRole = await interaction.guild.roles.fetch(clanRoleId).catch(() => null);
        const result = await clanManager.addUserToClanAndEnsureRole(interaction.guild, clanRoleId, invitedUserId, authorityToAssign, clanDiscordRole);
        
        if (result.success) {
            updatedEmbed.setColor('#2ECC71').addFields({ name: 'Status', value: `✅ Accepted by <@${invitedUserId}>.` });
        } else {
            updatedEmbed.setColor('#E74C3C').addFields({ name: 'Status', value: `❌ Failed: ${result.message}` });
        }
    } else { // 'deny'
        updatedEmbed.setColor('#808080').addFields({ name: 'Status', value: `❌ Denied by <@${invitedUserId}>.` });
    }
    
    await originalMessage.edit({ embeds: [updatedEmbed] });
};