// commands/economy/buy.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const economyManager = require('../../utils/economyManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('buy')
        .setDescription('Purchase a role from the shop.')
        .addRoleOption(option =>
            option.setName('item')
                .setDescription('The role you wish to purchase.')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });

        const roleToBuy = interaction.options.getRole('item');
        const user = interaction.member;

        if (user.roles.cache.has(roleToBuy.id)) {
            return interaction.editReply({ content: 'You already own this role!' });
        }

        const item = economyManager.getShopItem(roleToBuy.id);
        if (!item) {
            return interaction.editReply({ content: 'This role is not available for purchase in the shop.' });
        }

        const result = economyManager.purchaseItem(user.id, roleToBuy.id);

        if (result.success) {
            try {
                await user.roles.add(roleToBuy.id);
                const embed = new EmbedBuilder()
                    .setColor('#2ECC71')
                    .setTitle('Purchase Successful!')
                    .setDescription(`You have successfully purchased the **${roleToBuy.name}** role for **${result.price.toLocaleString()}** 🪙.`);
                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error('Failed to add role after purchase:', error);
                // Refund the user if role assignment fails
                economyManager.updateBalance(user.id, result.price);
                await interaction.editReply({ content: 'Purchase failed! I could not assign the role. Your Gold has been refunded.' });
            }
        } else {
            await interaction.editReply({ content: `Purchase failed: ${result.message}` });
        }
    },
};