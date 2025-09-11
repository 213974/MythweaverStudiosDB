// commands/economy/donate.js
const { SlashCommandBuilder } = require('discord.js');
const economyManager = require('../../utils/economyManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('donate')
        .setDescription('Donate Gold from your Sanctuary Balance to another user.')
        .addUserOption(option => option.setName('user').setDescription('The user you want to donate to.').setRequired(true))
        .addIntegerOption(option => option.setName('amount').setDescription('The amount of Gold to donate.').setRequired(true).setMinValue(1)),

    async execute(interaction) {
        const fromUser = interaction.user;
        const toUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        if (fromUser.id === toUser.id) {
            return interaction.reply({ content: 'You cannot donate to yourself, funny, real funny.', flags: 64 });
        }
        if (toUser.bot) {
            return interaction.reply({ content: 'You cannot donate to a bot...', flags: 64 });
        }

        const result = economyManager.transferGold(fromUser.id, toUser.id, amount);

        if (result.success) {
            await interaction.reply({ content: `You have successfully donated **${amount.toLocaleString()}** 🪙 to ${toUser.username}.` });
        } else {
            await interaction.reply({ content: `Payment failed: ${result.message}`, flags: 64 });
        }
    },
};