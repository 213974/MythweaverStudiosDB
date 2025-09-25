// src/handlers/interactions/clanInteractionHandler.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, UserSelectMenuBuilder, StringSelectMenuBuilder } = require('discord.js');
const clanManager = require('../../utils/clanManager');
const { subcommands: clanSubcommands } = require('../../commands/clan/clan');

module.exports = async (interaction) => {
    const customId = interaction.customId;
    const guild = interaction.guild;
    const user = interaction.user;
    const guildId = guild.id;

    // --- DASHBOARD SELECT MENU (Entry Point) ---
    if (interaction.isStringSelectMenu() && customId === 'clan_dashboard_menu') {
        const selection = interaction.values[0];
        const actingUserClan = clanManager.findClanContainingUser(guildId, user.id);
        const permissions = { isOwner: actingUserClan?.clanOwnerUserID === user.id, isVice: (actingUserClan?.viceGuildMasters || []).includes(user.id), isOfficer: (actingUserClan?.officers || []).includes(user.id) };

        if (!actingUserClan && !['dashboard_view'].includes(selection)) {
            return interaction.reply({ content: 'You must be in a clan to use this action.', flags: 64 });
        }

        // --- View & Leave Clan ---
        if (selection === 'dashboard_view' || selection === 'dashboard_leave') {
            const action = selection.split('_')[1];
            const command = clanSubcommands.get(action);
            if (command) {
                interaction.options = { getRole: () => null }; // Mock options to prevent crash
                return command.execute(interaction, guildId, actingUserClan, permissions);
            }
        }

        // --- Set Motto ---
        if (selection === 'dashboard_motto') {
            if (!permissions.isOwner) return interaction.reply({ content: 'Only the Clan Owner can set the motto.', flags: 64 });
            const modal = new (require('discord.js').ModalBuilder)().setCustomId('dashboard_motto_modal').setTitle('Set Clan Motto');
            modal.addComponents(new (require('discord.js').ActionRowBuilder)().addComponents(new (require('discord.js').TextInputBuilder)().setCustomId('motto_input').setLabel("New Motto (leave blank to remove)").setStyle(require('discord.js').TextInputStyle.Paragraph).setRequired(false)));
            return interaction.showModal(modal);
        }

        // --- WORKFLOWS REQUIRING A NEW EPHEMERAL MESSAGE (Kick, Authority) ---
        const cancelRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('dashboard_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary));

        if (selection === 'dashboard_kick') {
            if (!permissions.isOwner && !permissions.isVice && !permissions.isOfficer) return interaction.reply({ content: 'You do not have permission to kick members.', flags: 64 });
            const embed = new EmbedBuilder().setColor('#E74C3C').setTitle('👢 Kick Member').setDescription('Please select the member you wish to kick from your clan.');
            const userSelect = new UserSelectMenuBuilder().setCustomId('dashboard_kick_user_select').setPlaceholder('Select a user...');
            const userSelectRow = new ActionRowBuilder().addComponents(userSelect);
            return interaction.reply({ embeds: [embed], components: [userSelectRow, cancelRow], flags: 64 });
        }
        
        if (selection === 'dashboard_authority') {
            if (!permissions.isOwner && !permissions.isVice) return interaction.reply({ content: 'Only Owners and Vice Guild Masters can manage authority.', flags: 64 });
            const embed = new EmbedBuilder().setColor('#F1C40F').setTitle('⬆️ Manage Authority: Step 1 of 2').setDescription('Please select the member whose authority you wish to change.');
            const userSelect = new UserSelectMenuBuilder().setCustomId('dashboard_authority_user_select').setPlaceholder('Select a user...');
            const userSelectRow = new ActionRowBuilder().addComponents(userSelect);
            return interaction.reply({ embeds: [embed], components: [userSelectRow, cancelRow], flags: 64 });
        }
    }

    // --- USER SELECT MENUS (Step 2 of workflows) ---
    if (interaction.isUserSelectMenu()) {
        await interaction.deferUpdate();
        const selectionType = customId.split('_')[1]; // kick, authority
        const targetUserId = interaction.values[0];
        const actingUserClan = clanManager.findClanContainingUser(guildId, user.id);
        const permissions = { isOwner: actingUserClan?.clanOwnerUserID === user.id, isVice: (actingUserClan?.viceGuildMasters || []).includes(user.id), isOfficer: (actingUserClan?.officers || []).includes(user.id) };

        if (selectionType === 'kick') {
            const command = clanSubcommands.get('kick');
            interaction.options = { getUser: () => ({ id: targetUserId, tag: 'user' }), getString: () => 'Kicked via dashboard.' }; // Mock options
            if (command) return command.execute(interaction, guildId, actingUserClan, permissions);
        }

        if (selectionType === 'authority') {
            const embed = new EmbedBuilder().setColor('#F1C40F').setTitle('⬆️ Manage Authority: Step 2 of 2').setDescription(`Managing authority for <@${targetUserId}>. Please select their new authority level.`);
            const authorityMenu = new StringSelectMenuBuilder().setCustomId(`dashboard_authority_auth_select_${targetUserId}`).setPlaceholder('Select an authority level...').addOptions([{ label: 'Member', value: 'Member' }, { label: 'Officer', value: 'Officer' }, { label: 'Vice Guild Master', value: 'Vice Guild Master' }]);
            const cancelRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('dashboard_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary));
            const components = [new ActionRowBuilder().addComponents(authorityMenu), cancelRow];
            return interaction.editReply({ embeds: [embed], components: components });
        }
    }

    // --- STRING SELECT MENUS (Final Step of workflows) ---
    if (interaction.isStringSelectMenu() && customId.startsWith('dashboard_authority_auth')) {
        await interaction.deferUpdate();
        const parts = customId.split('_');
        const targetUserId = parts[4];
        const newAuthority = interaction.values[0];
        const actingUserClan = clanManager.findClanContainingUser(guildId, user.id);
        const permissions = { isOwner: actingUserClan?.clanOwnerUserID === user.id, isVice: (actingUserClan?.viceGuildMasters || []).includes(user.id) };

        const command = clanSubcommands.get('authority');
        if (command) {
            interaction.options = { getUser: () => ({ id: targetUserId, tag: 'user' }), getString: () => newAuthority }; // Mock options
            return command.execute(interaction, guildId, actingUserClan, permissions);
        }
    }

    // --- BUTTONS (Invites & Cancel) ---
    if (interaction.isButton()) {
        if (customId === 'dashboard_cancel') {
            return interaction.update({ content: 'Action cancelled.', embeds: [], components: [] });
        }

        const parts = customId.split('_');
        if (parts[0] === 'clan' && (parts[1] === 'accept' || parts[1] === 'deny')) {
            const action = parts[1];
            const clanRoleId = parts[2];
            const invitedUserId = parts[3];

            // --- THIS IS THE FIX ---
            // Perform the security check FIRST, before altering the original message.
            if (interaction.user.id !== invitedUserId) {
                // If the user is incorrect, send them a private message and stop.
                return interaction.reply({ content: "This invitation is not for you.", flags: 64 });
            }

            // If the check passes, we can now safely modify the public message.
            const originalMessage = interaction.message;
            const disabledRow = ActionRowBuilder.from(originalMessage.components[0]);
            disabledRow.components.forEach(component => component.setDisabled(true));
            await interaction.update({ components: [disabledRow] });
            
            const updatedEmbed = EmbedBuilder.from(originalMessage.embeds[0]);
            updatedEmbed.setFields([]); // Clear "Expires" field

            if (action === 'accept') {
                const authorityToAssign = parts[4].replace(/-/g, ' ');
                const clanDiscordRole = await guild.roles.fetch(clanRoleId).catch(() => null);
                const result = await clanManager.addUserToClanAndEnsureRole(guild, clanRoleId, invitedUserId, authorityToAssign, clanDiscordRole);
                
                if (result.success) {
                    updatedEmbed.setColor('#2ECC71').addFields({ name: 'Status', value: `✅ Accepted by <@${invitedUserId}>.` });
                } else {
                    updatedEmbed.setColor('#E74C3C').addFields({ name: 'Status', value: `❌ Failed: ${result.message}` });
                }
            } else { // 'deny'
                updatedEmbed.setColor('#808080').addFields({ name: 'Status', value: `❌ Denied by <@${invitedUserId}>.` });
            }
            
            await originalMessage.edit({ embeds: [updatedEmbed] });
        }
    }
    
    // --- MODAL SUBMIT (Motto Only) ---
    if (interaction.isModalSubmit() && customId === 'dashboard_motto_modal') {
        await interaction.deferReply({ flags: 64 });
        const motto = interaction.fields.getTextInputValue('motto_input') || null;
        const actingUserClan = clanManager.findClanContainingUser(guildId, user.id);
        const result = clanManager.setClanMotto(guildId, actingUserClan.clanRoleId, motto);
        if (result.success) {
            await interaction.editReply({ content: motto ? `Your clan motto has been updated to: *“${motto}”*` : 'Your clan motto has been removed.' });
        } else {
            await interaction.editReply({ content: `Failed to set motto: ${result.message}` });
        }
    }
};