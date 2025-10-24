// src/commands/wallet.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const economyManager = require('../managers/economyManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wallet')
        .setDescription('View your Solyx™ balance.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Optional: View the wallet of another user.')
                .setRequired(false)),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;

        const totalBalance = economyManager.getConsolidatedBalance(targetUser.id, interaction.guild.id);

        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setAuthor({ name: `${targetUser.displayName}'s Wallet`, iconURL: targetUser.displayAvatarURL() })
            .addFields(
                { name: 'Balance', value: `> ${totalBalance.toLocaleString()} Solyx™`, inline: true }
            )
            .setFooter({ text: 'Earn more Solyx™ by participating in server events!' });

        await interaction.reply({ embeds: [embed] });
    },
};