// src/handlers/interactions/economy/navigationHandler.js
const { EmbedBuilder } = require('discord.js');
const walletManager = require('../../../managers/economy/walletManager');

module.exports = async (interaction) => {
    const customId = interaction.customId;
    const user = interaction.user;
    const guildId = interaction.guild.id;

    if (customId === 'nav_view_bank') {
        // Changed from getWallet() to getConsolidatedBalance() for consistency
        // with the main /wallet command, ensuring the total balance is shown.
        const totalBalance = walletManager.getConsolidatedBalance(user.id, guildId);

        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setAuthor({ name: `${user.displayName}'s Wallet`, iconURL: user.displayAvatarURL() })
            .addFields({ name: 'Balance', value: `> ${totalBalance.toLocaleString()} Solyx™`, inline: true });
        
        await interaction.update({ embeds: [embed], components: [] });
    }

    if (customId === 'nav_view_shop') {
        const shopCommand = interaction.client.commands.get('shop');
        if (shopCommand) {
            // This interaction must be acknowledged before it can be used in a follow-up.
            await interaction.deferUpdate();
            await shopCommand.execute(interaction);
        }
    }
};