// commands/economy/bank.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const economyManager = require('../../utils/economyManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bank')
        .setDescription('Interact with your main player account.')
        .addSubcommand(subcommand =>
            subcommand.setName('view')
                .setDescription('View your player balance and capacity.')
                .addBooleanOption(option =>
                    option.setName('public')
                        .setDescription('Set to true to show this to everyone. Defaults to false.')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('deposit')
                .setDescription('Deposit Gold from your Sanctuary Balance into your player account.')
                .addIntegerOption(option => option.setName('amount').setDescription('The amount of Gold to deposit.').setRequired(true).setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand.setName('withdraw')
                .setDescription('Withdraw Gold from your player account into your Sanctuary Balance.')
                .addIntegerOption(option => option.setName('amount').setDescription('The amount of Gold to withdraw.').setRequired(true).setMinValue(1))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const user = interaction.user;

        if (subcommand === 'view') {
            const isPublic = interaction.options.getBoolean('public') ?? false;
            const wallet = economyManager.getWallet(user.id, 'Gold');
            const upgradeCost = economyManager.getBankUpgradeCost(wallet.bank_tier);

            const embed = new EmbedBuilder()
                .setColor('#3498DB')
                .setAuthor({ name: `${user.displayName}'s Player Account`, iconURL: user.displayAvatarURL() })
                .addFields(
                    { name: 'Player Balance', value: `> ${wallet.bank.toLocaleString()} 🪙`, inline: true },
                    { name: 'Max Capacity', value: `> ${wallet.bank_capacity.toLocaleString()} 🪙`, inline: true },
                    { name: 'Bank Tier', value: `> Tier ${wallet.bank_tier}`, inline: true },
                    { name: 'Next Tier Cost', value: `> ${upgradeCost.toLocaleString()} 🪙`, inline: false }
                )
                .setFooter({ text: 'Use your Player Balance to upgrade your bank.' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('nav_deposit').setLabel('Deposit').setStyle(ButtonStyle.Success).setEmoji('📥'),
                new ButtonBuilder().setCustomId('nav_withdraw').setLabel('Withdraw').setStyle(ButtonStyle.Primary).setEmoji('📤'),
                new ButtonBuilder().setCustomId('upgrade_bank').setLabel('Upgrade Bank').setStyle(ButtonStyle.Secondary).setEmoji('🚀'),
                new ButtonBuilder().setCustomId('nav_view_sanctuary').setLabel('View Sanctuary').setStyle(ButtonStyle.Secondary).setEmoji('⛩️')
            );

            await interaction.reply({ embeds: [embed], components: [row], ephemeral: !isPublic });
        }
        else if (subcommand === 'deposit') {
            const amount = interaction.options.getInteger('amount');
            const result = economyManager.depositToBank(user.id, amount, 'Gold');

            const wallet = economyManager.getWallet(user.id, 'Gold');
            const embed = new EmbedBuilder().setTitle('Player Account Deposit');

            if (result.success) {
                embed.setColor('#2ECC71').setDescription(`You successfully deposited **${amount.toLocaleString()}** 🪙 from your Sanctuary Balance into your player account.`);
            } else {
                embed.setColor('#E74C3C').setDescription(`Deposit failed: ${result.message}`);
            }
            embed.setFooter({ text: `New Player Balance: ${wallet.bank.toLocaleString()} 🪙 | New Sanctuary Balance: ${wallet.balance.toLocaleString()} 🪙` });
            await interaction.reply({ embeds: [embed], flags: 64 });
        }
        else if (subcommand === 'withdraw') {
            const amount = interaction.options.getInteger('amount');
            const result = economyManager.withdrawFromBank(user.id, amount, 'Gold');

            const wallet = economyManager.getWallet(user.id, 'Gold');
            const embed = new EmbedBuilder().setTitle('Player Account Withdrawal');

            if (result.success) {
                embed.setColor('#2ECC71').setDescription(`You successfully withdrew **${amount.toLocaleString()}** 🪙 from your player account to your Sanctuary Balance.`);
            } else {
                embed.setColor('#E74C3C').setDescription(`Withdrawal failed: ${result.message}`);
            }
            embed.setFooter({ text: `New Player Balance: ${wallet.bank.toLocaleString()} 🪙 | New Sanctuary Balance: ${wallet.balance.toLocaleString()} 🪙` });
            await interaction.reply({ embeds: [embed], flags: 64 });
        }
    },
};