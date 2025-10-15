// src/commands/help.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const { createClanHelpEmbed } = require('../components/help/clanHelp');
const { createUtilitiesHelpEmbed } = require('../components/help/utilitiesHelp');
const { createSolyxHelpEmbed } = require('../components/help/solyxHelp');
const { createSystemsHelpEmbed } = require('../components/help/systemsHelp');
const config = require('../config');
const db = require('../utils/database');

function createHelpDashboard() {
    const embed = new EmbedBuilder()
        .setColor('#4E6AF3')
        .setTitle('Bot Command & Feature Guide')
        .setDescription('Welcome! This dashboard is your central guide to the bot\'s features. Please select a category from the dropdown menu below to learn more. I will send the information privately in this channel.');

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('help_category_select')
        .setPlaceholder('Select a category...')
        .addOptions([
            { label: 'Clan Commands', description: 'Commands for clan creation and management.', value: 'help_clan', emoji: '🛡️' },
            { label: 'Utility Commands', description: 'General purpose and utility commands.', value: 'help_utilities', emoji: '⚙️' },
            { label: 'The Solyx™ Economy', description: 'Learn about the server currency and how to use it.', value: 'help_solyx', emoji: '🪙' },
            // --- THIS IS THE FIX ---
            { label: 'Systems Guide', description: 'Explanation of automated systems like referrals and raffles.', value: 'help_systems', emoji: '⚙️' }
        ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);
    return { embeds: [embed], components: [row] };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Access the bot\'s help dashboard or get info on a command category.')
        .addSubcommand(sub =>
            sub.setName('dashboard')
            .setDescription('Posts the interactive help dashboard. (Admin Only)')
        )
        .addSubcommand(sub =>
            sub.setName('get')
            .setDescription('Get help on a specific category.')
            .addStringOption(option =>
                option.setName('category')
                .setDescription('The category you need help with.')
                .setRequired(true)
                .addChoices(
                    { name: 'Clan Commands', value: 'clan' },
                    { name: 'Utility Commands', value: 'utilities' },
                    { name: 'Solyx™ Economy', value: 'solyx' },
                    { name: 'Systems Guide', value: 'systems' }
                )
            )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'dashboard') {
            const adminRoleId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'admin_role_id'").get(interaction.guild.id)?.value;
            const isOwner = config.ownerIDs.includes(interaction.user.id);
            const isAdmin = adminRoleId && interaction.member.roles.cache.has(adminRoleId);

            if (!isOwner && !isAdmin) {
                return interaction.reply({ content: 'You do not have permission to use this subcommand.', flags: 64 });
            }

            const dashboard = createHelpDashboard();
            await interaction.reply(dashboard);
        }

        if (subcommand === 'get') {
            const category = interaction.options.getString('category');
            let embed;

            switch (category) {
                case 'clan':
                    embed = createClanHelpEmbed();
                    break;
                case 'utilities':
                    embed = createUtilitiesHelpEmbed();
                    break;
                case 'solyx':
                    embed = createSolyxHelpEmbed();
                    break;
                case 'systems':
                    embed = createSystemsHelpEmbed();
                    break;
            }

            await interaction.reply({ embeds: [embed], flags: 64 });
        }
    },
    createHelpDashboard
};