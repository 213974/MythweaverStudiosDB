// src/components/adminDashboard/systemsPanel.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../utils/database');
const taxManager = require('../../managers/taxManager');

function createSystemsDashboard(guildId) {
    // Fetch current settings from the database
    const settings = db.prepare("SELECT key, value FROM settings WHERE guild_id = ? AND (key LIKE 'system_solyx_%' OR key LIKE 'economy_%_reward')").all(guildId);
    const settingsMap = new Map(settings.map(s => [s.key, s.value]));

    const textEnabled = settingsMap.get('system_solyx_text_enabled') === 'true';
    const vcEnabled = settingsMap.get('system_solyx_vc_enabled') === 'true';

    const textRate = settingsMap.get('system_solyx_text_rate') || '0.1';
    const vcRate = settingsMap.get('system_solyx_vc_rate') || '0.1';
    const vcInterval = settingsMap.get('system_solyx_vc_interval_minutes') || '5';
    
    const dailyReward = settingsMap.get('economy_daily_reward') || '1';
    const weeklyReward = settingsMap.get('economy_weekly_reward') || '2';
    
    // Fetch tax quota
    const taxQuota = taxManager.getTaxQuota(guildId);

    const embed = new EmbedBuilder()
        .setColor('#1ABC9C')
        .setTitle('⚙️ Systems Management ⚙️')
        .setDescription('Toggle and configure core economy systems.')
        .addFields(
            {
                name: '💬 Solyx™ per Message',
                value: `**Status:** ${textEnabled ? '🟢 Enabled' : '🔴 Disabled'}\n**Rate:** ${textRate} Solyx™ per message`,
                inline: true
            },
            {
                name: '🎙️ Solyx™ in Voice Chat',
                value: `**Status:** ${vcEnabled ? '🟢 Enabled' : '🔴 Disabled'}\n**Rate:** ${vcRate} Solyx™ per ${vcInterval} minutes`,
                inline: true
            },
            {
                name: '💰 Claim Rewards',
                value: `**Daily:** ${dailyReward} Solyx™\n**Weekly:** ${weeklyReward} Solyx™`,
                inline: true
            },
            {
                name: '🛡️ Clan Tax System',
                value: `**Monthly Quota:** ${taxQuota.toLocaleString()} Solyx™`,
                inline: false
            }
        );

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('admin_system_toggle_text')
            .setLabel(textEnabled ? 'Disable Text Rewards' : 'Enable Text Rewards')
            .setStyle(textEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('admin_system_toggle_vc')
            .setLabel(vcEnabled ? 'Disable VC Rewards' : 'Enable VC Rewards')
            .setStyle(vcEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('admin_system_configure_rates')
            .setLabel('Configure Rates')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔧'),
        new ButtonBuilder()
            .setCustomId('admin_system_configure_rewards')
            .setLabel('Configure Rewards')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('💰'),
        new ButtonBuilder()
            .setCustomId('admin_system_configure_tax')
            .setLabel('Set Tax Quota')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🛡️'),
        new ButtonBuilder()
            .setCustomId('admin_panel_back')
            .setLabel('Back to Main')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row1, row2] };
}

module.exports = { createSystemsDashboard };