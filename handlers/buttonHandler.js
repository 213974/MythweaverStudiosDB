// handlers/buttonHandler.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendOrUpdateDashboard } = require('../utils/dashboardManager');
const { sendOrUpdateAdminDashboard } = require('../utils/adminDashboardManager');
const economyManager = require('../utils/economyManager');

module.exports = {
    handleDashboardButton: async (interaction) => {
        const customId = interaction.customId;
        if (customId === 'dash_clan_set_channel') {
            const modal = new ModalBuilder().setCustomId('dash_clan_set_channel_modal').setTitle('Set Clan Dashboard Channel');
            const channelInput = new TextInputBuilder().setCustomId('channel_id_input').setLabel('Enter the ID of the text channel').setStyle(TextInputStyle.Short).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(channelInput));
            await interaction.showModal(modal);
        } else if (customId === 'dash_clan_refresh') {
            await interaction.deferReply({ flags: 64 });
            await sendOrUpdateDashboard(interaction.client);
            await interaction.editReply({ content: 'Clan Dashboard refresh initiated.' });
        } else if (customId === 'dash_admin_set_channel') {
            const modal = new ModalBuilder().setCustomId('dash_admin_set_channel_modal').setTitle('Set Admin Dashboard Channel');
            const channelInput = new TextInputBuilder().setCustomId('channel_id_input').setLabel('Enter the ID of the text channel').setStyle(TextInputStyle.Short).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(channelInput));
            await interaction.showModal(modal);
        } else if (customId === 'dash_admin_refresh') {
            await interaction.deferReply({ flags: 64 });
            await sendOrUpdateAdminDashboard(interaction.client);
            await interaction.editReply({ content: 'Admin Dashboard refresh initiated.' });
        }
    },

    handleNavButton: async (interaction) => {
        const customId = interaction.customId;
        const user = interaction.user;

        if (customId === 'nav_view_bank' || customId === 'view_bank_after_claim') {
            const wallet = economyManager.getWallet(user.id, 'Gold');
            const upgradeCost = economyManager.getBankUpgradeCost(wallet.bank_tier);
            const embed = new EmbedBuilder().setColor('#3498DB').setAuthor({ name: `${user.username}'s Player Account`, iconURL: user.displayAvatarURL() }).addFields(
                { name: 'Player Balance', value: `> ${wallet.bank.toLocaleString()} 🪙`, inline: true },
                { name: 'Max Capacity', value: `> ${wallet.bank_capacity.toLocaleString()} 🪙`, inline: true },
                { name: 'Bank Tier', value: `> Tier ${wallet.bank_tier}`, inline: true },
                { name: 'Next Tier Cost', value: `> ${upgradeCost.toLocaleString()} 🪙`, inline: false }
            ).setFooter({ text: 'Use your Player Balance to upgrade your bank.' });
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('nav_deposit').setLabel('Deposit').setStyle(ButtonStyle.Success).setEmoji('📥'),
                new ButtonBuilder().setCustomId('nav_withdraw').setLabel('Withdraw').setStyle(ButtonStyle.Primary).setEmoji('📤'),
                new ButtonBuilder().setCustomId('upgrade_bank').setLabel('Upgrade Bank').setStyle(ButtonStyle.Secondary).setEmoji('🚀'),
                new ButtonBuilder().setCustomId('nav_view_sanctuary').setLabel('View Sanctuary').setStyle(ButtonStyle.Secondary).setEmoji('⛩️')
            );
            await interaction.update({ embeds: [embed], components: [row] });
        } else if (customId === 'nav_view_sanctuary') {
            const wallet = economyManager.getWallet(user.id, 'Gold');
            const embed = new EmbedBuilder().setColor('#58D68D').setAuthor({ name: `${user.username}'s Sanctuary ⛩️`, iconURL: user.displayAvatarURL() }).addFields(
                { name: 'Sanctuary Balance', value: `> ${wallet.balance.toLocaleString()} 🪙`, inline: true },
                { name: 'Max Capacity', value: `> ${wallet.sanctuary_capacity.toLocaleString()} 🪙`, inline: true }
            ).setFooter({ text: 'This is your private reserve for your champions.' });
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('nav_view_bank').setLabel('View Player Bank').setStyle(ButtonStyle.Secondary).setEmoji('🏦')
            );
            await interaction.update({ embeds: [embed], components: [row] });
        } else if (customId === 'nav_deposit') {
            const modal = new ModalBuilder().setCustomId('nav_deposit_modal').setTitle('Deposit to Player Account');
            const amountInput = new TextInputBuilder().setCustomId('amount_input').setLabel('Amount to deposit from Sanctuary').setStyle(TextInputStyle.Short).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
            await interaction.showModal(modal);
        } else if (customId === 'nav_withdraw') {
            const modal = new ModalBuilder().setCustomId('nav_withdraw_modal').setTitle('Withdraw from Player Account');
            const amountInput = new TextInputBuilder().setCustomId('amount_input').setLabel('Amount to withdraw to Sanctuary').setStyle(TextInputStyle.Short).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
            await interaction.showModal(modal);
        } else if (customId === 'view_shop_after_claim') {
            const shopCommand = interaction.client.commands.get('shop');
            await shopCommand.execute(interaction);
        }
    },

    handleUpgradeButton: async (interaction) => {
        const customId = interaction.customId;
        const parts = customId.split('_');
        const user = interaction.user;

        if (parts[1] === 'bank' && parts[2] === 'confirm') {
            const userId = parts[3];
            if (user.id !== userId) return interaction.reply({ content: 'This confirmation is not for you.', flags: 64 });

            const result = economyManager.upgradeBankTier(userId, 'Gold');
            const embed = new EmbedBuilder();
            if (result.success) {
                embed.setColor('#2ECC71').setTitle('🚀 Bank Upgrade Successful!').setDescription(`You have successfully upgraded your bank to **Tier ${result.newTier}**!`).addFields(
                    { name: 'Cost', value: `> ${result.cost.toLocaleString()} 🪙`, inline: true },
                    { name: 'New Capacity', value: `> ${result.newCapacity.toLocaleString()} 🪙`, inline: true }
                );
            } else {
                embed.setColor('#E74C3C').setTitle('Upgrade Failed').setDescription(result.message);
            }
            await interaction.update({ embeds: [embed], components: [] });
        }
        else if (parts[1] === 'bank') { // This is the initial "Upgrade Bank" click
            const wallet = economyManager.getWallet(user.id, 'Gold');
            const cost = economyManager.getBankUpgradeCost(wallet.bank_tier);
            const embed = new EmbedBuilder().setColor('#F1C40F').setTitle(`Confirm Bank Upgrade: Tier ${wallet.bank_tier} ➔ ${wallet.bank_tier + 1}`).setDescription(`Are you sure you want to upgrade your bank? This action is irreversible.`).addFields(
                { name: 'Current Player Balance', value: `> ${wallet.bank.toLocaleString()} 🪙`, inline: true },
                { name: 'Upgrade Cost', value: `> **-${cost.toLocaleString()}** 🪙`, inline: true }
            );
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`upgrade_bank_confirm_${user.id}`).setLabel('Confirm Upgrade').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('nav_view_bank').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
            );
            await interaction.update({ embeds: [embed], components: [row] });
        }
    },
};