// commands/economy/balance.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const economyManager = require('../../utils/economyManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check a user\'s currency balance.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user whose balance you want to check. Defaults to yourself.')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('public')
                .setDescription('Set to true to show this to everyone. Defaults to false (visible only to you).')
                .setRequired(false)),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const isPublic = interaction.options.getBoolean('public') ?? false;
        const wallet = economyManager.getWallet(targetUser.id, 'Gold');

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setAuthor({ name: `${targetUser.username}'s Wallet`, iconURL: targetUser.displayAvatarURL() })
            .setDescription(`**Balance:** ${wallet.balance.toLocaleString()} 🪙`);

        await interaction.reply({ embeds: [embed], ephemeral: !isPublic });
    },
};