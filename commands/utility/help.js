// commands/utility/help.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

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
                        '`/clan leave` - Leave the clan you are currently in. Cannot be used by Clan Owners.',
                },
                // Clan Management Commands
                {
                    name: '────────── Clan Management (Owner/Vice Only) ──────────',
                    value: '`/clan invite <user> <authority>` - Invite a user to your clan as a Member or Officer.\n' +
                        '`/clan authority <user> <authority>` - Promote or demote an existing clan member.\n' +
                        '`/clan kick <user> [reason]` - Remove a member from your clan.',
                },
                // Clan Customization Commands
                {
                    name: '────────── Clan Customization (Owner Only) ──────────',
                    value: '`/clan motto [motto]` - Set or remove your clan\'s motto.\n' +
                        '`/clan color <hexcolor>` - Change the color of your clan\'s Discord role.',
                }
            )
            .setFooter({ text: 'Commands with [ ] are optional. Commands with < > are required.' })
            .setTimestamp();

        // Ephemeral makes the reply only visible to the user who executed the command
        await interaction.reply({ embeds: [helpEmbed], flags: 64 });
    },
};