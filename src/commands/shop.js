// commands/economy/shop.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const economyManager = require('../managers/economyManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Displays the items available for purchase.'),
    async execute(interaction) {
        const items = economyManager.getShopItems(interaction.guild.id);
        const embed = new EmbedBuilder().setColor('#3498DB').setTitle('Role Shop').setDescription('Here are the roles available for purchase with Solyx. Use `/buy <role>` to purchase an item.');

        if (items.length === 0) {
            embed.addFields({ name: 'No items available', value: 'The shop is currently empty. Check back later!' });
        } else {
            items.forEach(item => {
                embed.addFields({ name: `${item.name} - ${item.price.toLocaleString()} 🪙`, value: `<@&${item.role_id}>\n*${item.description || 'No description provided.'}*`, inline: false });
            });
        }
        
        const replyOptions = { embeds: [embed], flags: 64 };

        // If called from a button, the original interaction was the button press.
        // We cannot 'reply' again. Instead, we must send a new, ephemeral follow-up.
        if (interaction.isButton()) {
            return interaction.followUp(replyOptions);
        }
        
        // If it's a regular slash command, we reply as normal.
        await interaction.reply(replyOptions);
    },
};