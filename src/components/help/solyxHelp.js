// src/components/help/solyxHelp.js
const { EmbedBuilder } = require('discord.js');

function createSolyxHelpEmbed() {
    return new EmbedBuilder()
        .setColor('#F1C40F')
        .setTitle('<a:Yellow_Gem:1427764380489224295> The Solyx™ Economy')
        .setDescription('Solyx™ is the virtual currency of this server, earned through participation and used to acquire special roles and items.')
        .addFields(
            {
                name: 'Earning Solyx™',
                value: '`/daily` - Claim your daily reward once per day.\n' +
                       '`/weekly` - Claim a larger reward once per week.\n' +
                       '`/invite create` - Refer new members to the server.\n' +
                       '**Events** - Participate in server-wide events announced by admins.'
            },
            {
                name: 'Checking Your Balance',
                value: '`/wallet [user]` - View your own Solyx™ balance or that of another user.'
            },
            {
                name: 'Spending Solyx™',
                value: '`/shop` - View the list of available roles for purchase.\n' +
                       '`/buy <item>` - Purchase a role from the shop.\n' +
                       '**Raffles** - Buy tickets for raffles when they are active.'
            }
        )
        .setFooter({ text: '[ ] = optional, < > = required' });
}

module.exports = { createSolyxHelpEmbed };