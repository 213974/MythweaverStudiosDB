// handlers/buttonHandler.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendOrUpdateDashboard } = require('../utils/dashboardManager');
const economyManager = require('../utils/economyManager');

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

async function handleViewBank(interaction) {
    const user = interaction.user;
    const wallet = economyManager.getWallet(user.id, 'Gold');
    const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setAuthor({ name: `${user.username}'s Bank Account`, iconURL: user.displayAvatarURL() })
        .addFields(
            { name: 'Bank Balance', value: `> ${wallet.bank.toLocaleString()} 🪙`, inline: true },
            { name: 'Bank Capacity', value: `> ${wallet.bank_capacity.toLocaleString()} 🪙`, inline: true },
            { name: 'On-Hand Balance', value: `> ${wallet.balance.toLocaleString()} 🪙`, inline: false }
        )
        .setFooter({ text: 'Gold in your bank is safe. Use /bank deposit or /bank withdraw to manage it.' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('nav_deposit').setLabel('Deposit').setStyle(ButtonStyle.Success).setEmoji('📥'),
        new ButtonBuilder().setCustomId('nav_withdraw').setLabel('Withdraw').setStyle(ButtonStyle.Primary).setEmoji('📤'),
        new ButtonBuilder().setCustomId('nav_view_balance').setLabel('View Balance').setStyle(ButtonStyle.Secondary).setEmoji('💰')
    );

    // Using .update() because this handler is called from another component's interaction
    await interaction.update({ embeds: [embed], components: [row] });
}

async function handleViewShop(interaction) {
    const items = economyManager.getShopItems();
    const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle('Role Shop')
        .setDescription('Here are the roles available for purchase with Gold. Use `/buy <role>` to purchase an item.');

    if (items.length === 0) {
        embed.addFields({ name: 'No items available', value: 'The shop is currently empty. Check back later!' });
    } else {
        items.forEach(item => {
            embed.addFields({
                name: `${item.name} - ${item.price.toLocaleString()} 🪙`,
                value: `<@&${item.role_id}>\n*${item.description || 'No description provided.'}*`,
                inline: false,
            });
        });
    }

    // Using .update() because this handler is called from another component's interaction
    await interaction.update({ embeds: [embed], components: [] });
}

async function handleViewBalance(interaction) {
    const user = interaction.user;
    const wallet = economyManager.getWallet(user.id, 'Gold');
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setAuthor({ name: `${user.username}'s Wallet`, iconURL: user.displayAvatarURL() })
        .addFields({ name: 'On-Hand Balance', value: `${wallet.balance.toLocaleString()} 🪙` })
        .setFooter({ text: 'This is the Gold you can spend and donate. Use /bank to see your saved Gold.' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('nav_view_bank').setLabel('View Bank').setStyle(ButtonStyle.Primary).setEmoji('🏦')
    );

    // Using .update() because this handler is called from another component's interaction
    await interaction.update({ embeds: [embed], components: [row] });
}

async function handleNavDeposit(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('nav_deposit_modal')
        .setTitle('Deposit to Bank');
    const amountInput = new TextInputBuilder()
        .setCustomId('amount_input')
        .setLabel('Amount of Gold to deposit')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., 500')
        .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
    await interaction.showModal(modal);
}

async function handleNavWithdraw(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('nav_withdraw_modal')
        .setTitle('Withdraw from Bank');
    const amountInput = new TextInputBuilder()
        .setCustomId('amount_input')
        .setLabel('Amount of Gold to withdraw')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., 500')
        .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
    await interaction.showModal(modal);
}

module.exports = {
    handleSetDashboardChannel,
    handleRefreshDashboard,
    handleViewBank,
    handleViewShop,
    handleViewBalance,
    handleNavDeposit,
    handleNavWithdraw,
};