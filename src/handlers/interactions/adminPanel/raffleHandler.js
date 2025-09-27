// src/handlers/interactions/adminPanel/raffleHandler.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { createRaffleDashboard } = require('../../../components/adminDashboard/rafflePanel');
const chrono = require('chrono-node');
const { formatTimestamp } = require('../../../utils/timestampFormatter');
const db = require('../../../utils/database');
const config = require('../../../config');
const raffleManager = require('../../../utils/raffleManager');

module.exports = async (interaction) => {
    const guildId = interaction.guild.id;
    const raffleCreatorRoleId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'raffle_creator_role_id'").get(guildId)?.value;
    const isOwner = interaction.user.id === config.ownerID;
    const isRaffleCreator = raffleCreatorRoleId && interaction.member.roles.cache.has(raffleCreatorRoleId);

    if (!isOwner && !isRaffleCreator) {
        return interaction.reply({ content: 'You do not have permission to manage raffles.', flags: 64 });
    }

    if (interaction.isStringSelectMenu()) {
        const response = createRaffleDashboard();
        // If this interaction comes from the main selection menu, reply ephemerally.
        // Otherwise, update the existing admin panel message.
        if (interaction.customId === 'admin_panel_select') {
            return interaction.reply({ ...response, flags: 64 });
        } else {
            return interaction.update({ ...response });
        }
    }

    if (interaction.isButton()) {
        const action = interaction.customId.split('_')[2];
        if (action === 'create') {
            const modal = new ModalBuilder().setCustomId('admin_raffle_modal_create').setTitle('Create a New Raffle');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title_input').setLabel("Prize / Title").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('duration_input').setLabel("Duration (e.g., '3d', '12h 30m')").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cost_input').setLabel("Ticket Cost (0 for free)").setStyle(TextInputStyle.Short).setValue('100').setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('winners_input').setLabel("Number of Winners").setStyle(TextInputStyle.Short).setValue('1').setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('image_url_input').setLabel("Image URL (Optional)").setStyle(TextInputStyle.Short).setRequired(false))
            );
            await interaction.showModal(modal);
        }
        if (action === 'view') {
            const activeRaffles = db.prepare('SELECT * FROM raffles WHERE guild_id = ? AND status = ?').all(guildId, 'active');
            if (activeRaffles.length === 0) return interaction.reply({ content: 'There are no active raffles in this server.', flags: 64 });
            const embed = new EmbedBuilder().setColor('#1ABC9C').setTitle('Active Raffles');
            activeRaffles.forEach(r => {
                embed.addFields({ name: `ID: ${r.raffle_id} - ${r.title}`, value: `Ends ${formatTimestamp(r.end_timestamp, 'R')}` });
            });
            await interaction.reply({ embeds: [embed], flags: 64 });
        }
        if (action === 'end') {
            const modal = new ModalBuilder().setCustomId('admin_raffle_modal_end').setTitle('End a Raffle Early');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('raffle_id_input').setLabel("Raffle ID to End").setStyle(TextInputStyle.Short).setRequired(true)));
            await interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit()) {
        const customId = interaction.customId;
        if (customId === 'admin_raffle_modal_create') {
            await interaction.deferReply({ flags: 64 });
            try {
                const title = interaction.fields.getTextInputValue('title_input');
                const durationStr = interaction.fields.getTextInputValue('duration_input');
                const numWinners = parseInt(interaction.fields.getTextInputValue('winners_input'), 10);
                const ticketCost = parseInt(interaction.fields.getTextInputValue('cost_input'), 10);
                const imageUrl = interaction.fields.getTextInputValue('image_url_input') || null;
                const channelId = interaction.channel.id;
                const endDate = chrono.parseDate(durationStr, new Date(), { forwardDate: true });
                if (!endDate) return interaction.editReply({ content: 'Error: Invalid duration format.' });
                if (isNaN(numWinners) || numWinners < 1) return interaction.editReply({ content: 'Error: Number of winners must be at least 1.' });
                if (isNaN(ticketCost) || ticketCost < 0) return interaction.editReply({ content: 'Error: Ticket cost must be a positive number or 0.' });
                
                const endTimestamp = Math.floor(endDate.getTime() / 1000);
                const result = db.prepare('INSERT INTO raffles (guild_id, title, channel_id, ticket_cost, num_winners, end_timestamp, status, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(guildId, title, channelId, ticketCost, numWinners, endTimestamp, 'active', imageUrl);
                const raffleId = result.lastInsertRowid;

                const raffleEmbed = new EmbedBuilder().setColor('#1ABC9C').setTitle(`🎟️ Raffle Started: ${title} 🎟️`).addFields({ name: '🏆 Winners', value: `**${numWinners}**`, inline: true }, { name: '🎫 Ticket Cost', value: `**${ticketCost.toLocaleString()}** Solyx™`, inline: true }, { name: '⏰ Ends', value: `${formatTimestamp(endTimestamp, 'R')}` }).setFooter({ text: `Raffle ID: ${raffleId}` });
                if (imageUrl) raffleEmbed.setImage(imageUrl);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`raffle_buy_${raffleId}`).setLabel('Buy Ticket').setStyle(ButtonStyle.Success).setEmoji('🎫'),
                    new ButtonBuilder().setCustomId(`raffle_entries_${raffleId}`).setLabel('Participants: 0').setStyle(ButtonStyle.Secondary).setEmoji('👥'),
                );
                
                const raffleMessage = await interaction.channel.send({ embeds: [raffleEmbed], components: [row] });
                db.prepare('UPDATE raffles SET message_id = ? WHERE raffle_id = ?').run(raffleMessage.id, raffleId);
                await interaction.editReply({ content: `✅ Successfully created and announced the raffle in this channel!` });
            } catch (error) {
                console.error('[AdminRaffleCreate]', error);
                await interaction.editReply({ content: 'An error occurred while creating the raffle.' });
            }
        }
        if (customId === 'admin_raffle_modal_end') {
            await interaction.deferReply({ flags: 64 });
            const raffleId = parseInt(interaction.fields.getTextInputValue('raffle_id_input'), 10);
            if (isNaN(raffleId)) return interaction.editReply({ content: 'Invalid Raffle ID.' });
            const result = await raffleManager.drawRaffleWinners(interaction.client, raffleId);
            await interaction.editReply({ content: result.message });
        }
    }
};