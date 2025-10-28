// src/commands/settings.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config');
const db = require('../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Manage core bot configuration. [BOT OWNER ONLY]')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
       if (!config.ownerIDs.includes(interaction.user.id)) {
            return interaction.reply({ content: 'Access Denied. If you hug me I might let you in...', flags: 64 });
        }

        const guildId = interaction.guild.id;
        const settings = db.prepare("SELECT key, value FROM settings WHERE guild_id = ?").all(guildId);
        const settingsMap = new Map(settings.map(s => [s.key, s.value]));
        
        const formatChannel = (key) => settingsMap.has(key) ? `<#${settingsMap.get(key)}>` : '`Not Set`';
        const formatRole = (key) => settingsMap.has(key) ? `<@&${settingsMap.get(key)}>` : '`Not Set`';
        const formatCategory = (key) => {
            const categoryId = settingsMap.get(key);
            if (!categoryId) return '`Not Set`';
            const category = interaction.guild.channels.cache.get(categoryId);
            return category ? `\`${category.name}\`` : '`Not Set`';
        };


        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle(` Bot Core Settings for ${interaction.guild.name} `)
            .setDescription('Select a setting to manage from the dropdown menu. This interface is only available to the Bot Owner.')
            .addFields(
                { name: 'Admin Role', value: formatRole('admin_role_id'), inline: true },
                { name: 'Raffle Creator Role', value: formatRole('raffle_creator_role_id'), inline: true },
                { name: 'Booster Role', value: formatRole('booster_role_id'), inline: true },
                { name: 'Analytics Dashboard', value: formatChannel('analytics_channel_id'), inline: true },
                { name: 'Clan Dashboard', value: formatChannel('dashboard_channel_id'), inline: true },
                { name: 'Solyx™ Leaderboard', value: formatChannel('leaderboard_channel_id'), inline: true },
                { name: 'Help Dashboard', value: formatChannel('help_dashboard_channel_id'), inline: true },
                { name: 'Public Command List', value: formatChannel('public_cmd_list_channel_id'), inline: true },
                { name: 'Quick Actions Hub', value: formatChannel('quick_actions_channel_id'), inline: true },
                { name: 'Guildhalls Category', value: formatCategory('system_guildhall_category_id'), inline: true },
                { name: 'Welcome Channel', value: formatChannel('welcome_channel_id'), inline: true }
            );
            
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('settings_menu')
            .setPlaceholder('Select a setting to configure...')
            .addOptions([
                { label: 'Set Admin Role', value: 'settings_set_admin_role', emoji: '👑' },
                { label: 'Set Raffle Role', value: 'settings_set_raffle_role', emoji: '🎟️' },
                { label: 'Set Booster Role', value: 'settings_set_booster_role', emoji: '✨' },
                { label: 'Set Analytics Channel', value: 'settings_set_analytics_channel', emoji: '📊' },
                { label: 'Set Clan Dashboard Channel', value: 'settings_set_clan_dash', emoji: '⚔️' },
                { label: 'Set Solyx™ Leaderboard Channel', value: 'settings_set_leaderboard_channel', emoji: '🏆' },
                { label: 'Set Help Dashboard Channel', value: 'settings_set_help_channel', emoji: '❓' },
                { label: 'Set Public Command List Channel', value: 'settings_set_cmd_list_channel', emoji: '📜' },
                { label: 'Set Quick Actions Channel', value: 'settings_set_quick_actions_channel', emoji: '⚡' },
                { label: 'Set Guildhalls Category', value: 'settings_set_guildhall_category', emoji: '🏰' },
                { label: 'Set Welcome Channel', value: 'settings_set_welcome_channel', emoji: '👋' }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
    },
};