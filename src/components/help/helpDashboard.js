// src/components/help/helpDashboard.js
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

/**
 * Creates the interactive help dashboard embed and components.
 * @returns {{embeds: import('discord.js').EmbedBuilder[], components: import('discord.js').ActionRowBuilder[]}}
 */
function createHelpDashboard() {
    const embed = new EmbedBuilder()
        .setColor('#4E6AF3')
        .setTitle('Bot Command & Feature Guide')
        .setDescription('Welcome! This dashboard is your central guide to the bot\'s features. Please select a category from the dropdown menu below to learn more. I will send the information privately in this channel.');

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('help_category_select')
        .setPlaceholder('Select a category...')
        .addOptions([
            { label: 'Clan Commands', description: 'Commands for clan creation and management.', value: 'help_clan', emoji: '🛡️' },
            { label: 'Utility Commands', description: 'General purpose and utility commands.', value: 'help_utilities', emoji: '⚙️' },
            { label: 'The Solyx™ Economy', description: 'Learn about the server currency and how to use it.', value: 'help_solyx', emoji: '🪙' },
            { label: 'Systems Guide', description: 'Explanation of automated systems like referrals and raffles.', value: 'help_systems', emoji: '⚙️' }
        ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);
    return { embeds: [embed], components: [row] };
}

module.exports = { createHelpDashboard };