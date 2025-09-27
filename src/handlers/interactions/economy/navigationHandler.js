// src/handlers/interactions/economy/navigationHandler.js
const { EmbedBuilder } = require('discord.js');
const economyManager = require('../../../utils/economyManager');

module.exports = async (interaction) => {
    const customId = interaction.customId;
    const user = interaction.user;
    const guildId = interaction.guild.id;

    if (customId === 'nav_view_bank') {
        const wallet = economyManager.getWallet(user.id, guildId);
        const embed = new EmbedBuilder().setColor('#3498DB').setAuthor({ name: `${user.displayName}'s Wallet`, iconURL: user.displayAvatarURL() }).addFields({ name: 'Balance', value: `> ${wallet.balance.toLocaleString()} Solyx™`, inline: true });
        await interaction.update({ embeds: [embed], components: [] });
    }

    if (customId === 'nav_view_shop') {
        const shopCommand = interaction.client.commands.get('shop');
        if (shopCommand) {
            // --- THIS IS THE FIX ---
            // The original interaction (the button press) must be acknowledged
            // before it can be used in a follow-up. deferUpdate() does this.
            await interaction.deferUpdate();
            await shopCommand.execute(interaction);
        }
    }
};