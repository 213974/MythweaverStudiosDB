// src/components/adminDashboard/eventPanel.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../utils/database');
const { formatTimestamp } = require('../../utils/timestampFormatter');

function createEventDashboard(guildId) {
    const eventType = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'event_type'").get(guildId)?.value;
    const eventReward = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'event_reward'").get(guildId)?.value;
    const eventEnd = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'event_end_timestamp'").get(guildId)?.value;
    const eventStarter = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'event_started_by'").get(guildId)?.value;

    const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('<a:Yellow_Flame:1427764327708102798> Event Management <a:Yellow_Flame:1427764327708102798>')
    
    if (eventType) {
        embed.setDescription('An event is currently active. You can cancel it at any time.')
            .addFields(
                { name: 'Event Type', value: 'Solyx™ per Message', inline: true },
                { name: 'Reward', value: `**${eventReward}** <a:Yellow_Gem:1427764380489224295> per message`, inline: true },
                { name: 'Ends', value: formatTimestamp(eventEnd, 'R'), inline: true },
                { name: 'Started By', value: `<@${eventStarter}>`, inline: true }
            );
    } else {
        embed.setDescription('There is no event currently active. Use the button below to configure and start a new event.');
    }

    const configureButton = new ButtonBuilder()
        .setCustomId('admin_event_configure')
        .setLabel('Configure Event')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!!eventType); // Disable if an event is already running

    const cancelButton = new ButtonBuilder()
        .setCustomId('admin_event_cancel')
        .setLabel('Cancel Current Event')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!eventType); // Disable if no event is running
        
    const backButton = new ButtonBuilder()
        .setCustomId('admin_panel_back')
        .setLabel('Back to Main')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(configureButton, cancelButton, backButton);

    return { embeds: [embed], components: [row] };
}

module.exports = { createEventDashboard };