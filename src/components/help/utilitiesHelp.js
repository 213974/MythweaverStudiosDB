// src/components/help/utilitiesHelp.js
const { EmbedBuilder } = require('discord.js');

function createUtilitiesHelpEmbed() {
    return new EmbedBuilder()
        .setColor('#95A5A6')
        .setTitle('⚙️ Utility Command Guide')
        .setDescription('General purpose commands for server utility.')
        .addFields(
            {
                name: '/timestamp <datetime> [timezone] [format]',
                value: 'Generates a dynamic Discord timestamp that displays correctly for all users in their local time. Uses natural language input like `tomorrow at 4pm` or `in 2 hours`.'
            },
            {
                name: '/invite <create|view>',
                value: 'Create your own permanent referral link or view a list of users you have successfully referred to the server.'
            }
        )
        .setFooter({ text: '[ ] = optional, < > = required' });
}

module.exports = { createUtilitiesHelpEmbed };