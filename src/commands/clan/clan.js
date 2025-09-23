// src/commands/clan/clan.js
const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const clanManager = require('../../utils/clanManager');

// Load subcommand files dynamically
const subcommands = new Map();
const subcommandsPath = path.join(__dirname, 'subcommands');
const subcommandFiles = fs.readdirSync(subcommandsPath).filter(file => file.endsWith('.js'));

for (const file of subcommandFiles) {
    const filePath = path.join(subcommandsPath, file);
    const subcommand = require(filePath);
    // The name of the subcommand is the filename without .js
    subcommands.set(path.parse(file).name, subcommand);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clan')
        .setDescription('Manages all clan functionalities.')
        .addSubcommand(sub => sub.setName('view').setDescription('Views details about a clan.').addRoleOption(opt => opt.setName('clanrole').setDescription('The clan to view. Defaults to your own.')))
        .addSubcommand(sub => sub.setName('leave').setDescription('Leave your current clan.'))
        .addSubcommand(sub => sub.setName('invite').setDescription('Invites a user to your clan.').addUserOption(opt => opt.setName('user').setDescription('The user to invite.').setRequired(true)).addStringOption(opt => opt.setName('authority').setDescription('The authority level to invite as.').setRequired(true).addChoices({ name: 'Member', value: 'Member' }, { name: 'Officer', value: 'Officer' }, { name: 'Vice Guild Master', value: 'Vice Guild Master' })))
        .addSubcommand(sub => sub.setName('kick').setDescription('Kicks a member from your clan.').addUserOption(opt => opt.setName('user').setDescription('The user to kick.').setRequired(true)).addStringOption(opt => opt.setName('reason').setDescription('The reason for kicking.')))
        .addSubcommand(sub => sub.setName('authority').setDescription('Promotes or demotes a clan member.').addUserOption(opt => opt.setName('user').setDescription('The user to manage.').setRequired(true)).addStringOption(opt => opt.setName('authority').setDescription('The new authority level.').setRequired(true).addChoices({ name: 'Member', value: 'Member' }, { name: 'Officer', value: 'Officer' }, { name: 'Vice Guild Master', value: 'Vice Guild Master' })))
        .addSubcommand(sub => sub.setName('motto').setDescription("Sets or removes your clan's motto.").addStringOption(opt => opt.setName('motto').setDescription('The motto for your clan.')))
        .addSubcommand(sub => sub.setName('color').setDescription("Changes your clan's role color.").addStringOption(opt => opt.setName('hexcolor').setDescription('The new hex color code (e.g., #RRGGBB).').setRequired(true))),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        }
        
        const subcommandName = interaction.options.getSubcommand();
        const subcommand = subcommands.get(subcommandName);

        if (!subcommand) {
            return interaction.reply({ content: 'Error: Invalid subcommand.', ephemeral: true });
        }

        try {
            // Pre-fetch user's clan data and permissions to avoid redundant calls in sub-handlers
            const userClanData = clanManager.findClanContainingUser(interaction.user.id);
            const permissions = {
                isOwner: userClanData ? userClanData.clanOwnerUserID === interaction.user.id : false,
                isVice: userClanData ? (userClanData.viceGuildMasters || []).includes(interaction.user.id) : false,
                isOfficer: userClanData ? (userClanData.officers || []).includes(interaction.user.id) : false,
            };

            await subcommand.execute(interaction, userClanData, permissions);
        } catch (error) {
            console.error(`Error executing clan subcommand '${subcommandName}':`, error);
            await interaction.reply({ content: 'An error occurred while executing this clan command.', ephemeral: true });
        }
    },
};