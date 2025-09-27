// src/handlers/interactions/adminPanel/shopHandler.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { createShopDashboard } = require('../../../components/adminDashboard/shopPanel');
const economyManager = require('../../../utils/economyManager');
const { parseRole } = require('../../../utils/interactionHelpers');

module.exports = async (interaction) => {
    // --- NAVIGATION ---
    if (interaction.isStringSelectMenu()) {
        const response = createShopDashboard();
        // If this interaction comes from the main selection menu, reply ephemerally.
        // Otherwise, update the existing admin panel message.
        if (interaction.customId === 'admin_panel_select') {
            return interaction.reply({ ...response, flags: 64 });
        } else {
            return interaction.update({ ...response });
        }
    }

    // --- BUTTONS (Open Modals) ---
    if (interaction.isButton()) {
        const action = interaction.customId.split('_')[2]; // add, remove, update
        let modal;
        if (action === 'add') {
            modal = new ModalBuilder().setCustomId('admin_shop_modal_add').setTitle('Add Item to Shop');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('role_input').setLabel("Role (@Mention or ID)").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('price_input').setLabel("Price in Solyx™").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('desc_input').setLabel("Description (Optional)").setStyle(TextInputStyle.Paragraph).setRequired(false))
            );
        } else if (action === 'remove') {
            modal = new ModalBuilder().setCustomId('admin_shop_modal_remove').setTitle('Remove Item from Shop');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('role_input').setLabel("Role (@Mention or ID)").setStyle(TextInputStyle.Short).setRequired(true)));
        } else if (action === 'update') {
            modal = new ModalBuilder().setCustomId('admin_shop_modal_update').setTitle('Update Item Price');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('role_input').setLabel("Role (@Mention or ID)").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('price_input').setLabel("New Price in Solyx™").setStyle(TextInputStyle.Short).setRequired(true))
            );
        }
        if (modal) await interaction.showModal(modal);
    }

    // --- MODALS (Process Data) ---
    if (interaction.isModalSubmit()) {
        await interaction.deferReply({ flags: 64 });
        const action = interaction.customId.split('_')[3];
        const role = await parseRole(interaction.guild, interaction.fields.getTextInputValue('role_input'));
        if (!role) return interaction.editReply({ content: 'Error: Invalid Role provided.' });

        if (action === 'add') {
            const price = parseInt(interaction.fields.getTextInputValue('price_input'), 10);
            const description = interaction.fields.getTextInputValue('desc_input') || null;
            if (isNaN(price) || price < 0) return interaction.editReply({ content: 'Error: Price must be a positive number.' });
            const result = economyManager.addShopItem(role.id, interaction.guild.id, price, role.name, description);
            if (result.success) await interaction.editReply({ content: `Successfully added **${role.name}** to the shop for ${price.toLocaleString()} Solyx™.` });
            else await interaction.editReply({ content: `Failed to add item: ${result.message}` });
        } else if (action === 'remove') {
            const result = economyManager.removeShopItem(role.id, interaction.guild.id);
            if (result.success) await interaction.editReply({ content: `Successfully removed **${role.name}** from the shop.` });
            else await interaction.editReply({ content: `Failed to remove item. It may not be in the shop.` });
        } else if (action === 'update') {
            const price = parseInt(interaction.fields.getTextInputValue('price_input'), 10);
            if (isNaN(price) || price < 0) return interaction.editReply({ content: 'Error: Price must be a positive number.' });
            const result = economyManager.updateShopItem(role.id, interaction.guild.id, price);
            if (result.success) await interaction.editReply({ content: `Successfully updated the price of **${role.name}** to ${price.toLocaleString()} Solyx™.` });
            else await interaction.editReply({ content: `Failed to update item. It may not be in the shop.` });
        }
    }
};