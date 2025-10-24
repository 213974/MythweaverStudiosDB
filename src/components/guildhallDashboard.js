// src/components/guildhallDashboard.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { formatTimestamp } = require('../helpers/timestampFormatter');
const { endOfMonth } = require('date-fns');

/**
 * Creates the embed and components for a clan's guildhall dashboard.
 * @param {import('discord.js').Role} clanRole The clan's role object.
 * @param {object} taxStatus The clan's tax status from the taxManager.
 * @param {number} taxQuota The server-wide monthly tax quota.
 * @param {string|null} latestDonatorMention A mention string for the latest donator, or null.
 * @param {number} memberCount The total number of members in the clan.
 * @returns {{embeds: import('discord.js').EmbedBuilder[], components: import('discord.js').ActionRowBuilder[]}}
 */
function createGuildhallDashboard(clanRole, taxStatus, taxQuota, latestDonatorMention, memberCount) {
    const { amount_contributed } = taxStatus;
    const progress = taxQuota > 0 ? Math.min((amount_contributed / taxQuota) * 100, 100) : 100;
    const isQuotaMet = amount_contributed >= taxQuota;

    const progressBarLength = 10;
    const filledBlocks = Math.round(progress / 100 * progressBarLength);
    const emptyBlocks = progressBarLength - filledBlocks;
    const progressBar = '▰'.repeat(filledBlocks) + '▱'.repeat(emptyBlocks);

    const endOfMonthDate = endOfMonth(new Date());
    const nextResetTimestamp = Math.floor(endOfMonthDate.getTime() / 1000);

    // --- Dynamic field name based on quota status ---
    const quotaFieldName = isQuotaMet 
        ? 'Monthly Quota Completed <a:Golden_Check:1427763589732634746>' 
        : 'Monthly Quota';

    const embed = new EmbedBuilder()
        .setColor(isQuotaMet ? '#2ECC71' : (clanRole.color || '#ECF0F1'))
        .setTitle(`<:Golden_Shield:1427763714760769617> ${clanRole.name} Guildhall <:Golden_Shield:1427763714760769617>`)
        .setDescription('-# This is the central hub for your clan\'s activity.')
        .addFields(
            {
                name: quotaFieldName,
                value: `\`${progressBar}\`\n> **${amount_contributed.toLocaleString()} / ${taxQuota.toLocaleString()}** <a:Solyx_Currency:1431059951664627712> Contributed`,
                inline: false
            },
            {
                name: '<a:Sand_Time:1429464150467281046> Time Remaining',
                value: `Resets ${formatTimestamp(nextResetTimestamp, 'R')}`,
                inline: true
            },
            {
                name: '👥 Total Members',
                value: `> ${memberCount}`,
                inline: true
            },
            {
                name: '<a:Yellow_Flame:1427764327708102798> Latest Contribution',
                value: latestDonatorMention || '`None`',
                inline: true
            }
        )
        .setFooter({ text: 'Use the button below to contribute to your guild.' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`guildhall_contribute_${clanRole.id}`)
            .setLabel('Contribute Solyx™')
            .setStyle(ButtonStyle.Success)
            .setEmoji('<a:Solyx_Currency:1431059951664627712>')
    );

    return { embeds: [embed], components: [row] };
}

module.exports = { createGuildhallDashboard };