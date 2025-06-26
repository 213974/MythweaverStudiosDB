// events/interactionCreate.js
const { Events, EmbedBuilder, ActionRowBuilder } = require('discord.js');
const buttonHandler = require('../handlers/buttonHandler');
const selectMenuHandler = require('../handlers/selectMenuHandler');
const modalSubmitHandler = require('../handlers/modalSubmitHandler');
const clanManager = require('../utils/clanManager');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        try {
            if (interaction.isChatInputCommand()) {
                const command = client.commands.get(interaction.commandName);
                if (!command) {
                    console.error(`No command matching ${interaction.commandName} was found.`);
                    return interaction.reply({ content: 'Error: Command not found.', flags: 64 });
                }
                await command.execute(interaction);
            }
            else if (interaction.isButton()) {
                const customId = interaction.customId;
                const parts = customId.split('_');

                // --- Admin dashboard buttons ---
                if (customId === 'admin_dashboard_set_channel') await buttonHandler.handleSetDashboardChannel(interaction);
                else if (customId === 'admin_dashboard_refresh') await buttonHandler.handleRefreshDashboard(interaction);

                // --- Economy Navigation Buttons ---
                else if (customId === 'nav_view_bank') await buttonHandler.handleViewBank(interaction);
                else if (customId === 'nav_view_balance') await buttonHandler.handleViewBalance(interaction);
                else if (customId === 'nav_deposit') await buttonHandler.handleNavDeposit(interaction);
                else if (customId === 'nav_withdraw') await buttonHandler.handleNavWithdraw(interaction);

                // --- After-claim buttons ---
                else if (customId === 'view_bank_after_claim') await buttonHandler.handleViewBank(interaction);
                else if (customId === 'view_shop_after_claim') await buttonHandler.handleViewShop(interaction);

                // --- Clan Invite Buttons ---
                else if (parts[0] === 'clan' && (parts[1] === 'accept' || parts[1] === 'deny')) {
                    const originalMessage = interaction.message;
                    const originalEmbed = originalMessage.embeds[0];
                    if (!originalEmbed) return;

                    const disabledRow = ActionRowBuilder.from(originalMessage.components[0]);
                    disabledRow.components.forEach(component => component.setDisabled(true));
                    await interaction.update({ components: [disabledRow] });

                    const action = parts[1];
                    const clanRoleId = parts[2];
                    const invitedUserId = parts[3];

                    if (interaction.user.id !== invitedUserId) {
                        return interaction.followUp({ content: "This invitation is not for you.", flags: 64 });
                    }

                    const clanDiscordRole = await interaction.guild.roles.fetch(clanRoleId).catch(() => null);
                    const updatedEmbed = EmbedBuilder.from(originalEmbed);

                    if (action === 'accept') {
                        const authorityToAssign = parts[4].replace(/-/g, ' ');
                        const result = await clanManager.addUserToClanAndEnsureRole(client, interaction.guild, clanRoleId, invitedUserId, authorityToAssign, clanDiscordRole);
                        if (result.success) {
                            updatedEmbed.setColor('#00FF00').addFields({ name: 'Status', value: `✅ Accepted by <@${invitedUserId}>.` }).setTimestamp();
                        } else {
                            updatedEmbed.setColor('#FF0000').addFields({ name: 'Status', value: `❌ Failed: ${result.message}` }).setTimestamp();
                        }
                    } else { // Deny
                        updatedEmbed.setColor('#AAAAAA').addFields({ name: 'Status', value: `❌ Denied by <@${invitedUserId}>.` }).setTimestamp();
                    }
                    await originalMessage.edit({ embeds: [updatedEmbed] });
                }
            }
            else if (interaction.isStringSelectMenu()) {
                if (interaction.customId === 'clan_dashboard_menu') {
                    await selectMenuHandler.handleClanDashboardSelect(interaction);
                }
            }
            else if (interaction.isModalSubmit()) {
                const customId = interaction.customId;
                if (customId === 'dashboard_channel_modal') await modalSubmitHandler.handleDashboardChannelModal(interaction);
                else if (customId === 'dashboard_invite_modal') await modalSubmitHandler.handleInviteModal(interaction);
                else if (customId === 'dashboard_kick_modal') await modalSubmitHandler.handleKickModal(interaction);
                else if (customId === 'dashboard_motto_modal') await modalSubmitHandler.handleMottoModal(interaction);
                else if (customId === 'dashboard_authority_modal') await modalSubmitHandler.handleAuthorityModal(interaction);
                // --- Economy Navigation Modals ---
                else if (customId === 'nav_deposit_modal') await modalSubmitHandler.handleNavDepositModal(interaction);
                else if (customId === 'nav_withdraw_modal') await modalSubmitHandler.handleNavWithdrawModal(interaction);
            }
        } catch (error) {
            console.error(`Error during interaction execution:`, error);
            const replyOptions = { content: 'An error occurred while processing your request.', flags: 64 };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(replyOptions).catch(console.error);
            } else {
                await interaction.reply(replyOptions).catch(console.error);
            }
        }
    },
};