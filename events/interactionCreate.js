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
                return interaction.reply({ content: 'Error: Command not found.', flags: 64 }).catch(console.error);
            }
            try {
                // For chat input commands, clanManager functions are usually called from within the command's execute
                // and should be passed `client` and `interaction` (which has .guild if not DM)
                // e.g., await clanManager.someFunction(client, interaction, ...);
                await command.execute(interaction);
            } catch (error) {
                console.error(`Error executing ${interaction.commandName}:`, error);
                const replyOptions = { content: 'There was an error while executing this command!', flags: 64 };
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(replyOptions).catch(console.error);
                } else {
                    await interaction.reply(replyOptions).catch(console.error);
                }
            }
        } else if (interaction.isButton()) {
            const customId = interaction.customId;
            const parts = customId.split('_');

            if (parts[0] !== 'clan' || (parts[1] !== 'accept' && parts[1] !== 'deny')) return;

            const originalMessage = interaction.message;
            const newComponents = originalMessage.components.map(rowSource => {
                const row = ActionRowBuilder.from(rowSource);
                row.components = row.components.map(componentSource => ButtonBuilder.from(componentSource).setDisabled(true));
                return row;
            });
            await interaction.update({ components: newComponents }).catch(err => console.error("[Button Handler] Failed to disable buttons:", err));

            const action = parts[1];
            const clanRoleId = parts[2];
            const invitedUserId = parts[3];

            if (interaction.user.id !== invitedUserId) {
                return interaction.followUp({ content: "This invitation is not for you.", flags: 64 }).catch(console.error);
            }

            let guildForButton = interaction.guild; // Try to get from interaction first
            if (!guildForButton) { // If button clicked in DM, interaction.guild is null
                if (config.guildID) {
                    guildForButton = await client.guilds.fetch(config.guildID).catch(err => {
                        console.error(`[Button Handler] Failed to fetch guild with ID ${config.guildID}:`, err);
                        return null;
                    });
                }
                if (!guildForButton) {
                    return interaction.followUp({ content: 'Error: Could not determine the server for this clan operation.', flags: 64 }).catch(console.error);
                }
            }

            const clanDiscordRole = await guildForButton.roles.fetch(clanRoleId).catch(() => null);
            if (!clanDiscordRole) {
                return interaction.followUp({ content: 'Error: The clan role for this invite is missing or could not be found on the server.', flags: 64 }).catch(console.error);
            }

            if (action === 'accept') {
                const authorityToAssign = parts[4].replace(/-/g, ' ');
                // Pass client first, then the determined guild object (guildForButton)
                const result = await clanManager.addUserToClan(client, guildForButton, clanRoleId, invitedUserId, authorityToAssign, clanDiscordRole);
                if (result.success) {
                    await interaction.followUp({ content: `Welcome! You have successfully joined **${clanDiscordRole.name}** as a ${authorityToAssign}!`, flags: 64 }).catch(console.error);
                } else {
                    await interaction.followUp({ content: `Failed to join clan: ${result.message}`, flags: 64 }).catch(console.error);
                }
            } else if (action === 'deny') {
                await interaction.followUp({ content: `You have denied the invitation to join **${clanDiscordRole.name}**.`, flags: 64 }).catch(console.error);
            }
        }
    },
};