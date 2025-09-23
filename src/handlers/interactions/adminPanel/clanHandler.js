// src/handlers/interactions/adminPanel/clanHandler.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { createClanDashboard } = require('../../../components/admin-dashboard/clanPanel');
const clanManager = require('../../../utils/clanManager');
const { parseUser, parseRole } = require('../../../utils/interactionHelpers');

module.exports = async (interaction) => {
    // --- NAVIGATION ---
    if (interaction.isStringSelectMenu()) {
        const response = createClanDashboard();
        await interaction.update({ ...response });
    }

    // --- BUTTONS (Open Modals) ---
    if (interaction.isButton()) {
        const action = interaction.customId.split('_')[2]; // create, delete, owner
        let modal;

        if (action === 'create') {
            modal = new ModalBuilder().setCustomId('admin_clan_modal_create').setTitle('Create a New Clan');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('role_input').setLabel("Clan Role (@Mention or ID)").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('owner_input').setLabel("Clan Owner (@Mention or ID)").setStyle(TextInputStyle.Short).setRequired(true))
            );
        } else if (action === 'delete') {
            modal = new ModalBuilder().setCustomId('admin_clan_modal_delete').setTitle('Delete a Clan');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('role_input').setLabel("Clan Role (@Mention or ID)").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason_input').setLabel("Reason (Optional)").setStyle(TextInputStyle.Paragraph).setRequired(false))
            );
        } else if (action === 'owner') {
            modal = new ModalBuilder().setCustomId('admin_clan_modal_owner').setTitle('Change Clan Ownership');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('role_input').setLabel("Clan Role (@Mention or ID)").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('owner_input').setLabel("New Clan Owner (@Mention or ID)").setStyle(TextInputStyle.Short).setRequired(true))
            );
        }
        if (modal) await interaction.showModal(modal);
    }

    // --- MODALS (Process Data) ---
    if (interaction.isModalSubmit()) {
        await interaction.deferReply({ flags: 64 });
        const action = interaction.customId.split('_')[3];
        const clanRole = await parseRole(interaction.guild, interaction.fields.getTextInputValue('role_input'));
        if (!clanRole) return interaction.editReply({ content: 'Error: Invalid Clan Role provided.' });

        if (action === 'create') {
            const clanOwner = await parseUser(interaction.guild, interaction.fields.getTextInputValue('owner_input'));
            if (!clanOwner) return interaction.editReply({ content: 'Error: Invalid Clan Owner provided.' });
            const result = clanManager.createClan(clanRole.id, clanOwner.id);
            if (result.success) await interaction.editReply({ content: `Successfully created clan **${clanRole.name}** with owner ${clanOwner}.` });
            else await interaction.editReply({ content: `Failed to create clan: ${result.message}` });
        } else if (action === 'delete') {
            const result = clanManager.deleteClan(clanRole.id);
            if (result.success) await interaction.editReply({ content: `Successfully deleted clan **${clanRole.name}**.` });
            else await interaction.editReply({ content: `Failed to delete clan: ${result.message}` });
        } else if (action === 'owner') {
            const newOwner = await parseUser(interaction.guild, interaction.fields.getTextInputValue('owner_input'));
            if (!newOwner) return interaction.editReply({ content: 'Error: Invalid New Owner provided.' });
            const result = clanManager.setClanOwner(clanRole.id, newOwner.id);
            if (result.success) await interaction.editReply({ content: `Successfully transferred ownership of **${clanRole.name}** to ${newOwner}.` });
            else await interaction.editReply({ content: `Failed to transfer ownership: ${result.message}` });
        }
    }
};