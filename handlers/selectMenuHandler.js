// handlers/selectMenuHandler.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const clanManager = require('../utils/clanManager');

async function handleClanDashboardSelect(interaction) {
    const selection = interaction.values[0];

    // Check if the user is in a clan for most actions
    const actingUserClan = clanManager.findClanContainingUser(interaction.user.id);
    if (!actingUserClan && !['dashboard_view', 'dashboard_leave'].includes(selection)) {
        return interaction.reply({ content: 'You must be in a clan to use this action.', flags: 64 });
    }

    let actorIsOwner = false;
    let actorIsVice = false;

    if (actingUserClan) {
        actorIsOwner = actingUserClan.clanOwnerUserID === interaction.user.id;
        actorIsVice = (actingUserClan.viceGuildMasters || []).includes(interaction.user.id);
    }

    // --- SIMPLE ACTIONS (No Modal Needed) ---
    if (selection === 'dashboard_view') {
        return interaction.reply({ content: 'To view a clan, please use the command: `/clan view [clanrole]`', flags: 64 });
    }
    if (selection === 'dashboard_leave') {
        return interaction.reply({ content: 'To leave your clan, please use the command: `/clan leave`', flags: 64 });
    }

    // --- ACTIONS REQUIRING MODALS ---
    if (selection === 'dashboard_invite') {
        if (!actorIsOwner && !actorIsVice) return interaction.reply({ content: 'You do not have permission to invite members.', flags: 64 });

        const modal = new ModalBuilder().setCustomId('dashboard_invite_modal').setTitle('Invite Member to Clan');
        const userToInvite = new TextInputBuilder().setCustomId('user_input').setLabel('User ID or @Mention').setStyle(TextInputStyle.Short).setRequired(true);
        const authorityInput = new TextInputBuilder().setCustomId('authority_input').setLabel('Authority (Member, Officer, Vice Guild Master)').setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(userToInvite), new ActionRowBuilder().addComponents(authorityInput));
        await interaction.showModal(modal);
    }

    else if (selection === 'dashboard_kick') {
        if (!actorIsOwner && !actorIsVice && !(actingUserClan.officers || []).includes(interaction.user.id)) return interaction.reply({ content: 'You do not have permission to kick members.', flags: 64 });

        const modal = new ModalBuilder().setCustomId('dashboard_kick_modal').setTitle('Kick Member from Clan');
        const userToKick = new TextInputBuilder().setCustomId('user_input').setLabel('User ID or @Mention').setStyle(TextInputStyle.Short).setRequired(true);
        const reasonInput = new TextInputBuilder().setCustomId('reason_input').setLabel('Reason (Optional)').setStyle(TextInputStyle.Paragraph).setRequired(false);
        modal.addComponents(new ActionRowBuilder().addComponents(userToKick), new ActionRowBuilder().addComponents(reasonInput));
        await interaction.showModal(modal);
    }

    else if (selection === 'dashboard_motto') {
        if (!actorIsOwner) return interaction.reply({ content: 'Only the Clan Owner can set the motto.', flags: 64 });
        const modal = new ModalBuilder().setCustomId('dashboard_motto_modal').setTitle('Set Clan Motto');
        const mottoInput = new TextInputBuilder().setCustomId('motto_input').setLabel('Enter new motto (leave blank to remove)').setStyle(TextInputStyle.Paragraph).setRequired(false);
        modal.addComponents(new ActionRowBuilder().addComponents(mottoInput));
        await interaction.showModal(modal);
    }

    else if (selection === 'dashboard_authority') {
        if (!actorIsOwner && !actorIsVice) return interaction.reply({ content: 'You do not have permission to manage authority.', flags: 64 });
        const modal = new ModalBuilder().setCustomId('dashboard_authority_modal').setTitle('Manage Member Authority');
        const userToManage = new TextInputBuilder().setCustomId('user_input').setLabel('User ID or @Mention').setStyle(TextInputStyle.Short).setRequired(true);
        const authorityInput = new TextInputBuilder().setCustomId('authority_input').setLabel('New Authority (Member, Officer, Vice Guild Master)').setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(userToManage), new ActionRowBuilder().addComponents(authorityInput));
        await interaction.showModal(modal);
    }
}

module.exports = { handleClanDashboardSelect };