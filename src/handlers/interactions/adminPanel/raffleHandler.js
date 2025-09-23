// src/handlers/interactions/adminPanel/raffleHandler.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ChannelType } = require('discord.js');
const { createRaffleDashboard } = require('../../../components/admin-dashboard/rafflePanel');
const chrono = require('chrono-node');
const { formatTimestamp } = require('../../../utils/timestampFormatter');

module.exports = async (interaction) => {
    // --- NAVIGATION ---
    if (interaction.isStringSelectMenu()) {
        const response = createRaffleDashboard();
        await interaction.update({ ...response });
    }

    // --- BUTTONS (Open Modals) ---
    if (interaction.isButton()) {
        const action = interaction.customId.split('_')[2]; // create, end, view
        if (action === 'create') {
            const modal = new ModalBuilder().setCustomId('admin_raffle_modal_create').setTitle('Create a New Raffle');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title_input').setLabel("Prize / Title").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('duration_input').setLabel("Duration (e.g., '3d', '12h 30m')").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('winners_input').setLabel("Number of Winners").setStyle(TextInputStyle.Short).setValue('1').setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('channel_input').setLabel("Announcement Channel ID").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cost_input').setLabel("Ticket Cost (0 for free)").setStyle(TextInputStyle.Short).setValue('10').setRequired(true))
            );
            await interaction.showModal(modal);
        }
        // TODO: Add logic for 'end' and 'view' buttons
    }

    // --- MODALS (Process Data) ---
    if (interaction.isModalSubmit()) {
        await interaction.deferReply({ ephemeral: true });
        try {
            const title = interaction.fields.getTextInputValue('title_input');
            const durationStr = interaction.fields.getTextInputValue('duration_input');
            const numWinners = parseInt(interaction.fields.getTextInputValue('winners_input'), 10);
            const channelId = interaction.fields.getTextInputValue('channel_input');
            const ticketCost = parseInt(interaction.fields.getTextInputValue('cost_input'), 10);

            const endDate = chrono.parseDate(durationStr, new Date(), { forwardDate: true });
            if (!endDate) return interaction.editReply({ content: 'Error: Invalid duration format. (e.g., "3 days", "12h").' });

            const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
            if (!channel || channel.type !== ChannelType.GuildText) return interaction.editReply({ content: 'Error: Invalid Channel ID.' });
            if (isNaN(numWinners) || numWinners < 1) return interaction.editReply({ content: 'Error: Number of winners must be at least 1.' });
            if (isNaN(ticketCost) || ticketCost < 0) return interaction.editReply({ content: 'Error: Ticket cost must be a positive number or 0.' });

            const endTimestamp = Math.floor(endDate.getTime() / 1000);

            const db = require('../../../utils/database');
            const result = db.prepare('INSERT INTO raffles (title, description, channel_id, ticket_cost, num_winners, end_timestamp, status) VALUES (?, ?, ?, ?, ?, ?, ?)').run(title, `React or use buttons to enter!`, channel.id, ticketCost, numWinners, endTimestamp, 'active');
            const raffleId = result.lastInsertRowid;

            const raffleEmbed = new EmbedBuilder().setColor('#1ABC9C').setTitle(`🎟️ Raffle Started: ${title} 🎟️`).addFields(
                { name: '🏆 Winners', value: `**${numWinners}**`, inline: true }, { name: '🎫 Ticket Cost', value: `**${ticketCost.toLocaleString()}** Solyx™`, inline: true },
                { name: '⏰ Ends', value: `${formatTimestamp(endTimestamp, 'R')} (${formatTimestamp(endTimestamp, 'F')})` }
            ).setFooter({ text: `Raffle ID: ${raffleId}` });
            
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`raffle_buy_${raffleId}`).setLabel('Buy Ticket').setStyle(ButtonStyle.Success).setEmoji('🎫'));
            
            const raffleMessage = await channel.send({ embeds: [raffleEmbed], components: [row] });
            db.prepare('UPDATE raffles SET message_id = ? WHERE raffle_id = ?').run(raffleMessage.id, raffleId);

            await interaction.editReply({ content: `✅ Successfully created and announced the raffle in ${channel}!` });
        } catch (error) {
            console.error('[AdminRaffleCreate] Failed to create raffle:', error);
            await interaction.editReply({ content: 'An error occurred while creating the raffle.' });
        }
    }
};