// src/commands/wallet.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const economyManager = require('../utils/economyManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wallet')
        .setDescription('View your Solyx™ balance and capacity.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Optional: View the wallet of another user.')
                .setRequired(false)),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;

        const wallet = economyManager.getWallet(targetUser.id, interaction.guild.id);

        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setAuthor({ name: `${targetUser.displayName}'s Wallet`, iconURL: targetUser.displayAvatarURL() })
            .addFields(
                { name: 'Balance', value: `> ${wallet.balance.toLocaleString()} Solyx™`, inline: true },
                { name: 'Capacity', value: `> ${wallet.capacity.toLocaleString()} Solyx™`, inline: true }
            )
            .setFooter({ text: 'A larger capacity may be available through server perks or events.' });

        await interaction.reply({ embeds: [embed] });
    },
};