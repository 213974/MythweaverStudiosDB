// events/interactionCreate.js
const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const clanManager = require('../utils/clanManager');
const config = require('../src/config');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client /* config is passed by eventHandler */) {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return interaction.reply({ content: 'Error: Command not found.', ephemeral: true });
            }
            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`Error executing ${interaction.commandName}:`, error);
                const replyOptions = { content: 'There was an error while executing this command!', ephemeral: true };
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(replyOptions).catch(console.error);
                } else {
                    await interaction.reply(replyOptions).catch(console.error);
                }
            }
        } else if (interaction.isButton()) {
            const customId = interaction.customId;
            const parts = customId.split('_');
            const handlerType = parts[0];

            // --- CLAN INVITE HANDLER ---
            if (handlerType === 'clan' && (parts[1] === 'accept' || parts[1] === 'deny')) {
                const originalMessage = interaction.message;
                const originalEmbed = originalMessage.embeds[0];
                if (!originalEmbed) return; // Should not happen

                // Disable buttons on the original message first
                const disabledRow = ActionRowBuilder.from(originalMessage.components[0]);
                disabledRow.components.forEach(component => component.setDisabled(true));
                await interaction.update({ components: [disabledRow] }).catch(err => console.error("[Button Handler] Failed to disable buttons:", err));

                const action = parts[1];
                const clanRoleId = parts[2];
                const invitedUserId = parts[3];

                if (interaction.user.id !== invitedUserId) {
                    return interaction.followUp({ content: "This invitation is not for you.", ephemeral: true }).catch(console.error);
                }

                const guildForButton = interaction.guild;
                const clanDiscordRole = await guildForButton.roles.fetch(clanRoleId).catch(() => null);
                if (!clanDiscordRole) {
                    return interaction.followUp({ content: 'Error: The clan role for this invite is missing or could not be found.', ephemeral: true }).catch(console.error);
                }

                const updatedEmbed = EmbedBuilder.from(originalEmbed);

                if (action === 'accept') {
                    const authorityToAssign = parts[4].replace(/-/g, ' ');
                    // Use the new manager function that also handles role assignment
                    const result = await clanManager.addUserToClanAndEnsureRole(client, guildForButton, clanRoleId, invitedUserId, authorityToAssign, clanDiscordRole);

                    if (result.success) {
                        updatedEmbed.setColor('#00FF00')
                            .addFields({ name: 'Status', value: `✅ Accepted by <@${invitedUserId}>.` })
                            .setTimestamp();
                    } else {
                        updatedEmbed.setColor('#FF0000')
                            .addFields({ name: 'Status', value: `❌ Failed: ${result.message}` })
                            .setTimestamp();
                    }
                } else if (action === 'deny') {
                    updatedEmbed.setColor('#AAAAAA')
                        .addFields({ name: 'Status', value: `❌ Denied by <@${invitedUserId}>.` })
                        .setTimestamp();
                }

                // Edit the original message with the updated embed
                await originalMessage.edit({ embeds: [updatedEmbed] }).catch(err => console.error("[Button Handler] Failed to edit original invite message:", err));

            }
        }
    },
};