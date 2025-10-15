// src/commands/dev/settings.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');
const db = require('../../utils/database');

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
        const adminRoleId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'admin_role_id'").get(guildId)?.value;
        const raffleRoleId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'raffle_creator_role_id'").get(guildId)?.value;
        const analyticsChannelId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'analytics_channel_id'").get(guildId)?.value;
        const clanDashChannelId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'dashboard_channel_id'").get(guildId)?.value;
        const leaderboardChannelId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'leaderboard_channel_id'").get(guildId)?.value;
        const helpChannelId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'help_dashboard_channel_id'").get(guildId)?.value;
        const boosterRoleId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'booster_role_id'").get(guildId)?.value;
        
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle(` Bot Core Settings for ${interaction.guild.name} `)
            .setDescription('Select a setting to manage from the dropdown menu. This interface is only available to the Bot Owner.')
            .addFields(
                { name: 'Admin Role', value: adminRoleId ? `<@&${adminRoleId}>` : '`Not Set`' },
                { name: 'Raffle Creator Role', value: raffleRoleId ? `<@&${raffleRoleId}>` : '`Not Set`' },
                { name: 'Analytics Dashboard', value: analyticsChannelId ? `<#${analyticsChannelId}>` : '`Not Set`' },
                { name: 'Clan Dashboard', value: clanDashChannelId ? `<#${clanDashChannelId}>` : '`Not Set`' },
                { name: 'Solyx™ Leaderboard', value: leaderboardChannelId ? `<#${leaderboardChannelId}>` : '`Not Set`' },
                { name: 'Help Dashboard', value: helpChannelId ? `<#${helpChannelId}>` : '`Not Set`' },
                { name: 'Booster Role', value: boosterRoleId ? `<@&${boosterRoleId}>` : '`Not Set`' }
            );
            
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('settings_menu')
            .setPlaceholder('Select a setting to configure...')
            .addOptions([
                { label: 'Set Admin Role', value: 'settings_set_admin_role', emoji: '👑' },
                { label: 'Set Raffle Role', value: 'settings_set_raffle_role', emoji: '🎟️' },
                { label: 'Set Analytics Channel', value: 'settings_set_analytics_channel', emoji: '📊' },
                { label: 'Set Clan Dashboard Channel', value: 'settings_set_clan_dash', emoji: '⚔️' },
                { label: 'Set Solyx™ Leaderboard Channel', value: 'settings_set_leaderboard_channel', emoji: '🏆' },
                { label: 'Set Help Dashboard Channel', value: 'settings_set_help_channel', emoji: '❓' },
                { label: 'Set Booster Role', value: 'settings_set_booster_role', emoji: '✨' }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
    },
};