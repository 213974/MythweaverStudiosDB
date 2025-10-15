// src/components/help/clanHelp.js
const { EmbedBuilder } = require('discord.js');

function createClanHelpEmbed() {
    return new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle('🛡️ Clan Command Guide')
        .setDescription('All commands related to creating, managing, and interacting with clans.')
        .addFields(
            {
                name: 'General',
                value: '`/clan view [clanrole]` - View clan details. Defaults to your own.\n' +
                       '`/clan leave` - Leave your current clan (cannot be used by Owners).'
            },
            {
                name: 'Leadership (Owner/Vice)',
                value: '`/clan invite <user> <authority>` - Invite a user to your clan.\n' +
                       '`/clan authority <user> <authority>` - Promote or demote a member.'
            },
            {
                name: 'Management (Owner/Vice/Officer)',
                value: '`/clan kick <user> [reason]` - Remove a member from your clan.'
            },
            {
                name: 'Customization (Owner Only)',
                value: '`/clan motto [motto]` - Set, update, or remove your clan\'s motto.\n' +
                       '`/clan color <hexcolor>` - Change the color of your clan\'s role.'
            }
        )
        .setFooter({ text: '[ ] = optional, < > = required' });
}

module.exports = { createClanHelpEmbed };