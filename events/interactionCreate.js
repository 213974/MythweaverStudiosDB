// events/interactionCreate.js
const { Events, EmbedBuilder, ActionRowBuilder, Collection } = require('discord.js');
const buttonHandler = require('../handlers/buttonHandler');
const selectMenuHandler = require('../handlers/selectMenuHandler');
const modalSubmitHandler = require('../handlers/modalSubmitHandler');
const clanManager = require('../utils/clanManager');

const COMMAND_COOLDOWN_SECONDS = 2.5;

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

                const cooldowns = client.cooldowns.get('commands') || new Collection();
                const now = Date.now();
                const userTimestamp = cooldowns.get(interaction.user.id);

                if (userTimestamp) {
                    const expirationTime = userTimestamp + COMMAND_COOLDOWN_SECONDS * 1000;
                    if (now < expirationTime) {
                        const timeLeft = (expirationTime - now) / 1000;
                        return interaction.reply({ content: `Please wait ${timeLeft.toFixed(1)} more second(s) before using a command again.`, flags: 64 });
                    }
                }

                cooldowns.set(interaction.user.id, now);
                client.cooldowns.set('commands', cooldowns);
                setTimeout(() => cooldowns.delete(interaction.user.id), COMMAND_COOLDOWN_SECONDS * 1000);

                await command.execute(interaction);
            }
            else if (interaction.isButton()) {
                const customId = interaction.customId;
                const parts = customId.split('_');

                const buttonCooldowns = client.cooldowns.get('buttons') || new Collection();
                const now = Date.now();
                const userButtonTimestamp = buttonCooldowns.get(interaction.user.id);

                if (userButtonTimestamp) {
                    const expirationTime = userButtonTimestamp + COMMAND_COOLDOWN_SECONDS * 1000;
                    if (now < expirationTime) {
                        const timeLeft = (expirationTime - now) / 1000;
                        return interaction.reply({ content: `Please wait ${timeLeft.toFixed(1)} more second(s) before using a button again.`, flags: 64 });
                    }
                }
                buttonCooldowns.set(interaction.user.id, now);
                client.cooldowns.set('buttons', buttonCooldowns);
                setTimeout(() => buttonCooldowns.delete(interaction.user.id), COMMAND_COOLDOWN_SECONDS * 1000);

                // --- Button Routing by Prefix ---
                if (parts[0] === 'dash' && parts[1] === 'clan') await buttonHandler.handleClanDashboardButton(interaction);
                else if (parts[0] === 'dash' && parts[1] === 'admin') await buttonHandler.handleAdminDashboardButton(interaction);
                else if (parts[0] === 'nav') await buttonHandler.handleNavButton(interaction);
                else if (parts[0] === 'upgrade' && parts[1] === 'bank' && parts[2] === 'confirm') await modalSubmitHandler.handleUpgradeBankConfirm(interaction);
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

                    if (interaction.user.id !== invitedUserId) return interaction.followUp({ content: "This invitation is not for you.", flags: 64 });

                    const clanDiscordRole = await interaction.guild.roles.fetch(clanRoleId).catch(() => null);
                    const updatedEmbed = EmbedBuilder.from(originalEmbed);

                    if (action === 'accept') {
                        const authorityToAssign = parts[4].replace(/-/g, ' ');
                        const result = await clanManager.addUserToClanAndEnsureRole(client, interaction.guild, clanRoleId, invitedUserId, authorityToAssign, clanDiscordRole);
                        if (result.success) updatedEmbed.setColor('#00FF00').addFields({ name: 'Status', value: `✅ Accepted by <@${invitedUserId}>.` }).setTimestamp();
                        else updatedEmbed.setColor('#FF0000').addFields({ name: 'Status', value: `❌ Failed: ${result.message}` }).setTimestamp();
                    } else {
                        updatedEmbed.setColor('#AAAAAA').addFields({ name: 'Status', value: `❌ Denied by <@${invitedUserId}>.` }).setTimestamp();
                    }
                    await originalMessage.edit({ embeds: [updatedEmbed] });
                }
            }
            else if (interaction.isStringSelectMenu()) {
                if (interaction.customId === 'clan_dashboard_menu') await selectMenuHandler.handleClanDashboardSelect(interaction);
                else if (interaction.customId === 'admin_dashboard_menu') await selectMenuHandler.handleAdminDashboardSelect(interaction);
            }
            else if (interaction.isModalSubmit()) {
                const customId = interaction.customId;
                if (customId === 'dash_clan_set_channel_modal') await modalSubmitHandler.handleSetClanChannelModal(interaction);
                else if (customId === 'dash_admin_set_channel_modal') await modalSubmitHandler.handleSetAdminChannelModal(interaction);
                else if (customId.startsWith('dashboard_')) await modalSubmitHandler.handleClanDashboardModal(interaction);
                else if (customId.startsWith('admin_dash_')) await modalSubmitHandler.handleAdminDashboardModal(interaction);
                else if (customId.startsWith('nav_')) await modalSubmitHandler.handleNavModal(interaction);
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