// commands/economy/bank.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const economyManager = require('../../utils/economyManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bank')
        .setDescription('Interact with your secure bank account.')
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
                .setAuthor({ name: `${user.username}'s Bank Account`, iconURL: user.displayAvatarURL() })
                .addFields(
                    { name: 'Bank Balance', value: `> ${wallet.bank.toLocaleString()} 🪙`, inline: true },
                    { name: 'Bank Capacity', value: `> ${wallet.bank_capacity.toLocaleString()} 🪙`, inline: true },
                    { name: 'On-Hand Balance', value: `> ${wallet.balance.toLocaleString()} 🪙`, inline: false }
                )
                .setFooter({ text: 'Gold in your bank is safe. Use /bank deposit or /bank withdraw to manage it.' });

            await interaction.reply({ embeds: [embed], ephemeral: !isPublic });
        }
        else if (subcommand === 'deposit') {
            const amount = interaction.options.getInteger('amount');
            const result = economyManager.depositToBank(user.id, amount, 'Gold');

            const wallet = economyManager.getWallet(user.id, 'Gold');
            const embed = new EmbedBuilder().setTitle('Bank Deposit');

            if (result.success) {
                embed.setColor('#2ECC71')
                    .setDescription(`You successfully deposited **${amount.toLocaleString()}** 🪙 into your bank.`);
            } else {
                embed.setColor('#E74C3C')
                    .setDescription(`Deposit failed: ${result.message}`);
            }
            embed.setFooter({ text: `New Bank Balance: ${wallet.bank.toLocaleString()} 🪙 | New On-Hand Balance: ${wallet.balance.toLocaleString()} 🪙` });
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        else if (subcommand === 'withdraw') {
            const amount = interaction.options.getInteger('amount');
            const result = economyManager.withdrawFromBank(user.id, amount, 'Gold');

            const wallet = economyManager.getWallet(user.id, 'Gold');
            const embed = new EmbedBuilder().setTitle('Bank Withdrawal');

            if (result.success) {
                embed.setColor('#2ECC71')
                    .setDescription(`You successfully withdrew **${amount.toLocaleString()}** 🪙 from your bank.`);
            } else {
                embed.setColor('#E74C3C')
                    .setDescription(`Withdrawal failed: ${result.message}`);
            }
            embed.setFooter({ text: `New Bank Balance: ${wallet.bank.toLocaleString()} 🪙 | New On-Hand Balance: ${wallet.balance.toLocaleString()} 🪙` });
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};