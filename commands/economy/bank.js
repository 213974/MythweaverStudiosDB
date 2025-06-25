// commands/economy/bank.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const economyManager = require('../../utils/economyManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bank')
        .setDescription('Interact with your bank account.')
        .addSubcommand(subcommand =>
            subcommand.setName('view')
                .setDescription('View your bank balance and capacity.')
                .addBooleanOption(option =>
                    option.setName('public')
                        .setDescription('Set to true to show this to everyone. Defaults to false.')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('deposit')
                .setDescription('Deposit Gold from your balance into your bank.')
                .addIntegerOption(option => option.setName('amount').setDescription('The amount of Gold to deposit.').setRequired(true).setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand.setName('withdraw')
                .setDescription('Withdraw Gold from your bank into your balance.')
                .addIntegerOption(option => option.setName('amount').setDescription('The amount of Gold to withdraw.').setRequired(true).setMinValue(1))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const user = interaction.user;

        if (subcommand === 'view') {
            const isPublic = interaction.options.getBoolean('public') ?? false;
            const wallet = economyManager.getWallet(user.id, 'Gold');
            const embed = new EmbedBuilder()
                .setColor('#3498DB')
                .setTitle(`${user.username}'s Bank Account`)
                .addFields(
                    { name: 'Bank Balance', value: `${wallet.bank.toLocaleString()} 🪙`, inline: true },
                    { name: 'Bank Capacity', value: `${wallet.bank_capacity.toLocaleString()} 🪙`, inline: true },
                    { name: 'Current Balance (On-hand)', value: `${wallet.balance.toLocaleString()} 🪙`, inline: true }
                )
                .setFooter({ text: 'Use /bank deposit or /bank withdraw to manage your funds.' });

            await interaction.reply({ embeds: [embed], ephemeral: !isPublic });
        }
        else if (subcommand === 'deposit') {
            const amount = interaction.options.getInteger('amount');
            const result = economyManager.depositToBank(user.id, amount, 'Gold');
            const wallet = economyManager.getWallet(user.id, 'Gold');

            const embed = new EmbedBuilder()
                .setTitle('Bank Deposit')
                .setFooter({ text: `New Bank Balance: ${wallet.bank.toLocaleString()} 🪙 | New On-Hand Balance: ${wallet.balance.toLocaleString()} 🪙` });

            if (result.success) {
                embed.setColor('#2ECC71')
                    .setDescription(`You have successfully deposited **${amount.toLocaleString()}** 🪙 into your bank.`);
                await interaction.reply({ embeds: [embed] });
            } else {
                embed.setColor('#E74C3C')
                    .setDescription(`Deposit failed: ${result.message}`);
                await interaction.reply({ embeds: [embed], flags: 64 });
            }
        }
        else if (subcommand === 'withdraw') {
            const amount = interaction.options.getInteger('amount');
            const result = economyManager.withdrawFromBank(user.id, amount, 'Gold');
            const wallet = economyManager.getWallet(user.id, 'Gold');

            const embed = new EmbedBuilder()
                .setTitle('Bank Withdrawal')
                .setFooter({ text: `New Bank Balance: ${wallet.bank.toLocaleString()} 🪙 | New On-Hand Balance: ${wallet.balance.toLocaleString()} 🪙` });

            if (result.success) {
                embed.setColor('#2ECC71')
                    .setDescription(`You have successfully withdrawn **${amount.toLocaleString()}** 🪙 from your bank.`);
                await interaction.reply({ embeds: [embed] });
            } else {
                embed.setColor('#E74C3C')
                    .setDescription(`Withdrawal failed: ${result.message}`);
                await interaction.reply({ embeds: [embed], flags: 64 });
            }
        }
    },
};