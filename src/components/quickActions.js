// src/components/quickActions.js
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

/**
 * Creates the components for the Quick Actions dashboard.
 * @returns {{embeds: import('discord.js').EmbedBuilder[], components: import('discord.js').ActionRowBuilder[]}}
 */
function createQuickActionsDashboard() {
    const embed = new EmbedBuilder()
        .setColor('#ffae00') // Gold color
        .setTitle('<a:Yellow_Flame:1427764327708102798> Quick Actions Hub <a:Yellow_Flame:1427764327708102798>')
        .setDescription(
            "-# Use the dropdown menu below to quickly access common commands like claiming your daily and weekly rewards."
        )
        .setFooter({ text: 'Mythweaver Studios | Quick Actions' });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('quick_action_select')
        .setPlaceholder('Select an action...')
        .addOptions([
            {
                label: 'Claim Daily Reward',
                description: 'Claim your daily Solyx™ reward.',
                value: 'qa_daily',
                emoji: '🪙'
            },
            {
                label: 'Claim Weekly Reward',
                description: 'Claim your weekly Solyx™ reward.',
                value: 'qa_weekly',
                emoji: '💎'
            }
        ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    return { embeds: [embed], components: [row] };
}

module.exports = { createQuickActionsDashboard };