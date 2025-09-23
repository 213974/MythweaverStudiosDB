// commands/admin/settings.js
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin-settings')
        .setDescription('Manage bot settings.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('setting')
                .setDescription('The setting you want to manage.')
                .setRequired(true)
                .addChoices(
                    { name: 'Clan Dashboard', value: 'clan_dashboard' },
                    { name: 'Admin Dashboard', value: 'admin_dashboard' }
                )),

    async execute(interaction) {
        if (interaction.user.id !== config.ownerID && !interaction.member.roles.cache.has(config.serverAdminRoleID)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: 64 });
        }

        const settingToManage = interaction.options.getString('setting');

        if (settingToManage === 'clan_dashboard') {
            const embed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('Clan Dashboard Management')
                .setDescription('Use the buttons below to manage the clan receptionist dashboard.');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('dash_clan_set_channel')
                    .setLabel('Set Channel')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔧'),
                new ButtonBuilder()
                    .setCustomId('dash_clan_refresh')
                    .setLabel('Refresh Dashboard')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🔄')
            );

            await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
        } else if (settingToManage === 'admin_dashboard') {
            const embed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('Administrator Dashboard Management')
                .setDescription('Use the buttons below to manage the administrator control panel.');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('dash_admin_set_channel')
                    .setLabel('Set Channel')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔧'),
                new ButtonBuilder()
                    .setCustomId('dash_admin_refresh')
                    .setLabel('Refresh Dashboard')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🔄')
            );

            await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
        }
    },
};