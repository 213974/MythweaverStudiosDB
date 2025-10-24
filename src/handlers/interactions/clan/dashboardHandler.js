// src/handlers/interactions/clan/dashboardHandler.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, UserSelectMenuBuilder, StringSelectMenuBuilder } = require('discord.js');
const clanManager = require('../../../managers/clanManager');
const { subcommands: clanSubcommands } = require('../../../commands/clan/clan');

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

        if (selection === 'dashboard_view' || selection === 'dashboard_leave') {
            const action = selection.split('_')[1];
            const command = clanSubcommands.get(action);
            if (command) {
                interaction.options = { getRole: () => null }; 
                return command.execute(interaction, guildId, actingUserClan, permissions);
            }
        }

        if (selection === 'dashboard_motto') {
            if (!permissions.isOwner) return interaction.reply({ content: 'Only the Clan Owner can set the motto.', flags: 64 });
            const modal = new (require('discord.js').ModalBuilder)().setCustomId('dashboard_motto_modal').setTitle('Set Clan Motto');
            modal.addComponents(new (require('discord.js').ActionRowBuilder)().addComponents(new (require('discord.js').TextInputBuilder)().setCustomId('motto_input').setLabel("New Motto (leave blank to remove)").setStyle(require('discord.js').TextInputStyle.Paragraph).setRequired(false)));
            return interaction.showModal(modal);
        }

        const cancelRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('dashboard_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary));
        if (selection === 'dashboard_kick') {
            if (!permissions.isOwner && !permissions.isVice && !permissions.isOfficer) return interaction.reply({ content: 'You do not have permission to kick members.', flags: 64 });
            const embed = new EmbedBuilder().setColor('#E74C3C').setTitle('👢 Kick Member').setDescription('Please select the member you wish to kick from your clan.');
            const userSelect = new UserSelectMenuBuilder().setCustomId('dashboard_kick_user_select').setPlaceholder('Select a user...');
            return interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(userSelect), cancelRow], flags: 64 });
        }
        
        if (selection === 'dashboard_authority') {
            if (!permissions.isOwner && !permissions.isVice) return interaction.reply({ content: 'Only Owners and Vice Guild Masters can manage authority.', flags: 64 });
            const embed = new EmbedBuilder().setColor('#F1C40F').setTitle('⬆️ Manage Authority: Step 1 of 2').setDescription('Please select the member whose authority you wish to change.');
            const userSelect = new UserSelectMenuBuilder().setCustomId('dashboard_authority_user_select').setPlaceholder('Select a user...');
            return interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(userSelect), cancelRow], flags: 64 });
        }
    }

    // --- USER SELECT MENUS ---
    if (interaction.isUserSelectMenu()) {
        await interaction.deferUpdate();
        const selectionType = customId.split('_')[1];
        const targetUserId = interaction.values[0];
        const actingUserClan = clanManager.findClanContainingUser(guildId, user.id);
        const permissions = { isOwner: actingUserClan?.clanOwnerUserID === user.id, isVice: (actingUserClan?.viceGuildMasters || []).includes(user.id), isOfficer: (actingUserClan?.officers || []).includes(user.id) };

        if (selectionType === 'kick') {
            const command = clanSubcommands.get('kick');
            interaction.options = { getUser: () => ({ id: targetUserId, tag: 'user' }), getString: () => 'Kicked via dashboard.' };
            if (command) return command.execute(interaction, guildId, actingUserClan, permissions);
        }

        if (selectionType === 'authority') {
            const embed = new EmbedBuilder().setColor('#F1C40F').setTitle('⬆️ Manage Authority: Step 2 of 2').setDescription(`Managing authority for <@${targetUserId}>. Please select their new authority level.`);
            const authorityMenu = new StringSelectMenuBuilder().setCustomId(`dashboard_authority_auth_select_${targetUserId}`).setPlaceholder('Select an authority level...').addOptions([{ label: 'Member', value: 'Member' }, { label: 'Officer', value: 'Officer' }, { label: 'Vice Guild Master', value: 'Vice Guild Master' }]);
            const cancelRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('dashboard_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary));
            return interaction.editReply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(authorityMenu), cancelRow] });
        }
    }

    // --- STRING SELECT MENUS ---
    if (interaction.isStringSelectMenu() && customId.startsWith('dashboard_authority_auth')) {
        await interaction.deferUpdate();
        const parts = customId.split('_');
        const targetUserId = parts[4];
        const newAuthority = interaction.values[0];
        const actingUserClan = clanManager.findClanContainingUser(guildId, user.id);
        const permissions = { isOwner: actingUserClan?.clanOwnerUserID === user.id, isVice: (actingUserClan?.viceGuildMasters || []).includes(user.id) };
        const command = clanSubcommands.get('authority');
        if (command) {
            interaction.options = { getUser: () => ({ id: targetUserId, tag: 'user' }), getString: () => newAuthority };
            return command.execute(interaction, guildId, actingUserClan, permissions);
        }
    }

    // --- CANCEL BUTTON ---
    if (interaction.isButton() && customId === 'dashboard_cancel') {
        return interaction.update({ content: 'Action cancelled.', embeds: [], components: [] });
    }
};