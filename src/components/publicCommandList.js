// src/components/publicCommandList.js
const { EmbedBuilder } = require('discord.js');

/**
 * Creates the embed for the public command list dashboard.
 * @returns {import('discord.js').EmbedBuilder}
 */
function createPublicCommandListEmbed() {
    return new EmbedBuilder()
        .setColor('#ffae00') // Gold color
        .setTitle('<:Golden_Shield:1427763714760769617> Bot Command List <:Golden_Shield:1427763714760769617>')
        .setDescription(
            "Here is a list of available commands. For detailed explanations, please use the `/help` command or the interactive help dashboard."
        )
        .addFields(
            {
                name: 'Economy & Rewards',
                value: '`/daily` `/weekly` `/wallet` `/shop` `/buy` `/profile`',
                inline: false
            },
            {
                name: 'Clans',
                value: '`/clan view` `/clan leave` `/clan invite` `/clan kick` `/clan authority` `/clan motto` `/clan color`',
                inline: false
            },
            {
                name: 'Utilities',
                value: '`/invite create` `/invite view` `/timestamp` `/help`',
                inline: false
            }
        )
        .setFooter({ text: 'Mythweaver Studios | Public Commands' })
        .setTimestamp();
}

module.exports = { createPublicCommandListEmbed };