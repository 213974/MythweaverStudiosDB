// src/handlers/interactions/adminPanel/economyHandler.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { createEconomyDashboard } = require('../../../components/adminDashboard/economyPanel');
const economyManager = require('../../../managers/economyManager');
const { parseUser } = require('../../../helpers/interactionHelpers');

module.exports = async (interaction) => {
    if (interaction.isStringSelectMenu()) {
        const response = createEconomyDashboard();
        // If this interaction comes from the main selection menu, reply ephemerally.
        // Otherwise, update the existing admin panel message.
        if (interaction.customId === 'admin_panel_select') {
            return interaction.reply({ ...response, flags: 64 });
        } else {
            return interaction.update({ ...response });
        }
    }

    if (interaction.isButton()) {
        const action = interaction.customId.split('_')[2]; // give, remove, set
        const modal = new ModalBuilder().setCustomId(`admin_eco_modal_${action}`).setTitle(`Economy: ${action.charAt(0).toUpperCase() + action.slice(1)} Solyx™`);
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('user_input').setLabel("Target User (@Mention, ID, or Name)").setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount_input').setLabel("Amount").setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason_input').setLabel("Reason (for logs)").setStyle(TextInputStyle.Paragraph).setRequired(false))
        );
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit()) {
        await interaction.deferReply({ flags: 64 });
        const action = interaction.customId.split('_')[3];
        const targetMember = await parseUser(interaction.guild, interaction.fields.getTextInputValue('user_input'));
        const amountStr = interaction.fields.getTextInputValue('amount_input').replace(/,/g, '');
        let amount = parseFloat(amountStr);
        const reason = interaction.fields.getTextInputValue('reason_input') || 'No reason provided.';
        
        if (!targetMember || isNaN(amount)) {
            return interaction.editReply({ content: 'Error: Invalid user or amount provided.' });
        }
        
        let result;
        if (action === 'give') {
            if (amount < 0) amount = Math.abs(amount); // Ensure give is always positive
            result = economyManager.modifySolyx(targetMember.id, interaction.guild.id, amount, reason, interaction.user.id);
        } else if (action === 'remove') {
            if (amount > 0) amount = -amount; // Ensure remove is always negative
            result = economyManager.modifySolyx(targetMember.id, interaction.guild.id, amount, reason, interaction.user.id);
        } else if (action === 'set') {
            const currentWallet = economyManager.getWallet(targetMember.id, interaction.guild.id);
            const modificationAmount = amount - currentWallet.balance; // Calculate the difference
            result = economyManager.modifySolyx(targetMember.id, interaction.guild.id, modificationAmount, `Set balance to ${amount} (${reason})`, interaction.user.id);
        }

        if (result && result.success) {
            const embed = new EmbedBuilder().setColor('#3498DB').setTitle('⚖️ Economy Administration Log').setDescription(`Action by ${interaction.user}.`).addFields(
                { name: 'Action', value: `\`${action}\``, inline: true }, { name: 'User', value: `${targetMember}`, inline: true }, { name: 'Amount', value: `**${action === 'set' ? '' : amount.toLocaleString()}** Solyx™`, inline: true },
                { name: 'New Balance', value: `${result.newBalance.toLocaleString()} Solyx™` }, { name: 'Reason', value: reason }
            ).setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.editReply({ content: 'An error occurred while modifying the user\'s balance.' });
        }
    }
};