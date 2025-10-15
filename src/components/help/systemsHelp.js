// src/components/help/systemsHelp.js
const { EmbedBuilder } = require('discord.js');

function createSystemsHelpEmbed() {
    return new EmbedBuilder()
        .setColor('#1ABC9C')
        .setTitle('⚙️ Bot Systems Guide')
        .setDescription('This guide explains the core automated systems of the bot.')
        .addFields(
            {
                name: '🔗 The Referral System',
                value: 'The referral system rewards you for inviting new members to the server.\n' +
                       '1. **Create Your Link:** Use `/invite create` to generate your own permanent invite link.\n' +
                       '2. **Invite Users:** Share this link with friends. When they join, you become their referrer.\n' +
                       '3. **Initial Bonus:** You receive an immediate **20 Solyx™** bonus for each new member who joins using your link.\n' +
                       '4. **Passive Income:** You earn a **1 Solyx™** passive bonus every time one of your referred users claims their `/daily` reward.\n' +
                       '5. **Leaving Penalty:** If a user you referred leaves the server *after* becoming active (claiming at least one daily), a **20 Solyx™** penalty will be deducted from your wallet.'
            },
            {
                name: '🎟️ The Raffle System',
                value: 'The raffle system allows admins to host giveaways for prizes.\n' +
                       '1. **Announcement:** New raffles are announced in their designated channels.\n' +
                       '2. **Buy Tickets:** Click the "Buy Ticket" button on the raffle message to purchase a ticket using your Solyx™.\n' +
                       '3. **Check Participants:** You can click the "Participants" button at any time to see how many users have entered.\n' +
                       '4. **Winner Selection:** When the timer ends, the bot automatically and randomly draws the specified number of winners from the pool of unique participants.\n' +
                       '5. **Winner Announcement:** Winners are announced in a new message (with a ping), and the original raffle embed is updated to show the winner(s).'
            }
        );
}

module.exports = { createSystemsHelpEmbed };