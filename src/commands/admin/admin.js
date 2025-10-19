// src/commands/admin/admin.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createMainDashboard } = require('../../components/adminDashboard/mainPanel');
const { createEconomyDashboard } = require('../../components/adminDashboard/economyPanel');
const { createClanDashboard } = require('../../components/adminDashboard/clanPanel');
const { createShopDashboard } = require('../../components/adminDashboard/shopPanel');
const { createRaffleDashboard } = require('../../components/adminDashboard/rafflePanel');
const config = require('../../config');
const db = require('../../utils/database');

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
                    { name: 'Raffles', value: 'raffles' },
                    { name: 'Events', value: 'events' }
                )),
    async execute(interaction) {
        const adminRoleId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'admin_role_id'").get(interaction.guild.id)?.value;
        
        const isOwner = config.ownerIDs.includes(interaction.user.id);
        const isAdmin = adminRoleId && interaction.member.roles.cache.has(adminRoleId);

        if (!isOwner && !isAdmin) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: 64 });
        }

        const section = interaction.options.getString('section');
        let response;

        switch (section) {
            case 'economy':
                response = createEconomyDashboard();
                break;
            case 'clans':
                response = createClanDashboard();
                break;
            case 'shop':
                response = createShopDashboard();
                break;
            case 'raffles':
                response = createRaffleDashboard();
                break;
            default:
                response = createMainDashboard();
        }

        await interaction.reply({ ...response, flags: 64 });
    },
};