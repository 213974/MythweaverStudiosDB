// src/commands/dev/settings.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');
const db = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Manage core bot configuration. [BOT OWNER ONLY]')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        if (interaction.user.id !== config.ownerID) {
            return interaction.reply({
                content: 'Only Solo has access to this command. `:D`, soon to be Choshen as well.',
                flags: 64
            });
        }

        const adminRoleId = db.prepare("SELECT value FROM settings WHERE key = 'admin_role_id'").get()?.value;
        const analyticsChannelId = db.prepare("SELECT value FROM settings WHERE key = 'analytics_channel_id'").get()?.value;
        const clanDashChannelId = db.prepare("SELECT value FROM settings WHERE key = 'dashboard_channel_id'").get()?.value;

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🛠️ Bot Core Settings 🛠️')
            .setDescription('Manage essential bot variables. This interface is only available to I, Solo.')
            .addFields(
                { name: 'Admin Role', value: adminRoleId ? `<@&${adminRoleId}>` : '`Not Set`' },
                { name: 'Analytics Dashboard', value: analyticsChannelId ? `<#${analyticsChannelId}>` : '`Not Set`' },
                { name: 'Clan Dashboard', value: clanDashChannelId ? `<#${clanDashChannelId}>` : '`Not Set`' }
            );

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('settings_set_admin_role').setLabel('Set Admin Role').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('settings_set_analytics_channel').setLabel('Set Analytics Channel').setStyle(ButtonStyle.Secondary)
        );
        
        const row2 = new ActionRowBuilder().addComponents(
             new ButtonBuilder().setCustomId('settings_set_clan_dash').setLabel('Set Clan Dashboard Channel').setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ embeds: [embed], components: [row1, row2], flags: 64 });
    },
};