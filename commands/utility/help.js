// commands/utility/help.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../src/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Displays a list of available commands and their descriptions.'),
    async execute(interaction) {
        const helpEmbed = new EmbedBuilder()
            .setColor('#4E6AF3')
            .setTitle('Bot Command Guide')
            .setDescription('Here is a list of commands available to you. For more details on a command, you can try using it.')
            .addFields(
                // General Clan Commands
                {
                    name: '────────── General Clan Commands ──────────',
                    value: '`/clan view [clanrole]` - View the details of a clan. Shows your own if no role is specified.\n' +
                        '`/clan leave` - Leave the clan you are currently in. Cannot be used by Clan Owners.\n' +
                        '`/clan disband` - Permanently disbands your clan (Owner only).',
                },
                // Clan Management Commands
                {
                    name: '────────── Clan Management (Leadership) ──────────',
                    value: '`/clan invite <user> <authority>` - Invite a user to your clan (Owner/Vice only).\n' +
                        '`/clan authority <user> <authority>` - Promote or demote an existing clan member (Owner/Vice only).\n' +
                        '`/clan kick <user> [reason]` - Remove a member from your clan (Owner/Vice/Officer). Officers can only kick Members.',
                },
                // Clan Customization Commands
                {
                    name: '────────── Clan Customization (Owner Only) ──────────',
                    value: '`/clan motto [motto]` - Set or remove your clan\'s motto.\n' +
                        '`/clan color <hexcolor>` - Change the color of your clan\'s Discord role.',
                },
                // Utility Commands
                {
                    name: '────────── Utility Commands ──────────',
                    value: '`/timestamp <datetime> [timezone]` - Generates a dynamic timestamp for everyone to see in their own time.'
                }
            )
            .setFooter({ text: 'Commands with [ ] are optional. Commands with < > are required.' })
            .setTimestamp();

        if (interaction.user.id === config.ownerID) {
            // If the user is the bot owner, send the help message publicly.
            await interaction.reply({ embeds: [helpEmbed] });
        } else {
            // For all other users, send it as an ephemeral message.
            await interaction.reply({ embeds: [helpEmbed], flags: 64 });
        }
    },
};