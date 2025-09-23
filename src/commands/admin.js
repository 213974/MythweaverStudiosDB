// src/commands/admin/admin.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createMainDashboard } = require('../components/admin-dashboard/mainPanel');
const { createEconomyDashboard } = require('../components/admin-dashboard/economyPanel');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Access the administrative dashboard.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('section')
                .setDescription('Jump directly to a specific section of the dashboard.')
                .setRequired(false)
                .addChoices(
                    { name: 'Economy', value: 'economy' },
                    { name: 'Clans', value: 'clans' },
                    { name: 'Shop', value: 'shop' },
                    { name: 'Raffles', value: 'raffles' }
                )),
    async execute(interaction) {
        // Permission check
        if (interaction.user.id !== config.ownerID && !interaction.member.roles.cache.has(config.serverAdminRoleID)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const section = interaction.options.getString('section');
        let response;

        // Route to a specific panel or the main one
        switch (section) {
            case 'economy':
                response = createEconomyDashboard();
                break;
            // Add cases for 'clans', 'shop', 'raffles' here when they are built
            // case 'clans':
            //     response = createClanDashboard();
            //     break;
            default:
                response = createMainDashboard();
        }

        await interaction.reply({ ...response, ephemeral: true });
    },
};