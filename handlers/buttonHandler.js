// handlers/buttonHandler.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const economyManager = require('../utils/economyManager');
const { sendOrUpdateDashboard } = require('../utils/dashboardManager');

async function handleSetDashboardChannel(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('dashboard_channel_modal')
        .setTitle('Set Clan Dashboard Channel');

    const channelInput = new TextInputBuilder()
        .setCustomId('channel_id_input')
        .setLabel('Enter the ID of the text channel')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., 123456789012345678')
        .setRequired(true);

    const actionRow = new ActionRowBuilder().addComponents(channelInput);
    modal.addComponents(actionRow);
    await interaction.showModal(modal);
}

async function handleRefreshDashboard(interaction) {
    await interaction.deferReply({ flags: 64 });
    await sendOrUpdateDashboard(interaction.client);
    await interaction.editReply({ content: 'Dashboard refresh initiated successfully.' });
}

async function handleDailyClaim(interaction) {
    const result = economyManager.claimDaily(interaction.user.id);
    if (result.success) {
        await interaction.update({ content: `You have successfully claimed your daily reward of **${result.reward}** 🪙!`, components: [] });
    } else {
        await interaction.update({ content: `Claim failed: ${result.message}`, components: [] });
    }
}

async function handleWeeklyClaim(interaction) {
    const result = economyManager.claimWeekly(interaction.user.id);
    if (result.success) {
        await interaction.update({ content: `You have successfully claimed your weekly reward of **${result.reward}** 💎!`, components: [] });
    } else {
        await interaction.update({ content: `Claim failed: ${result.message}`, components: [] });
    }
}

module.exports = {
    handleSetDashboardChannel,
    handleRefreshDashboard,
    handleDailyClaim,
    handleWeeklyClaim,
};