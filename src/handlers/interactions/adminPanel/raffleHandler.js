// src/handlers/interactions/adminPanel/raffleHandler.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ChannelType } = require('discord.js');
const { createRaffleDashboard } = require('../../../components/admin-dashboard/rafflePanel');
const chrono = require('chrono-node');
const { formatTimestamp } = require('../../../utils/timestampFormatter');
const db = require('../../../utils/database');
const config = require('../../../config');

// This function can now be called by the scheduler as well
async function drawRaffleWinners(client, raffleId) {
    const raffle = db.prepare('SELECT * FROM raffles WHERE raffle_id = ?').get(raffleId);
    if (!raffle || raffle.status !== 'active') return { success: false, message: 'Raffle not found or has already ended.' };

    const entries = db.prepare('SELECT user_id FROM raffle_entries WHERE raffle_id = ?').all(raffle.raffle_id);
    const channel = await client.channels.fetch(raffle.channel_id).catch(() => null);
    if (!channel) {
        db.prepare("UPDATE raffles SET status = 'ended', winner_id = 'Error: Channel not found' WHERE raffle_id = ?").run(raffle.raffle_id);
        return { success: false, message: 'Could not find the raffle channel.' };
    }

    let winners = [];
    let announcementDescription;

    if (entries.length > 0) {
        const uniqueParticipants = [...new Set(entries.map(e => e.user_id))];
        // Simple shuffle for randomness
        const shuffled = uniqueParticipants.sort(() => 0.5 - Math.random());
        winners = shuffled.slice(0, raffle.num_winners);
        const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
        announcementDescription = `The raffle for **${raffle.title}** has concluded! Congratulations to our winner(s):\n\n${winnerMentions}`;
    } else {
        announcementDescription = 'The raffle has ended, but there were no entries.';
    }

    db.prepare("UPDATE raffles SET status = 'ended', winner_id = ? WHERE raffle_id = ?").run(winners.join(','), raffle.raffle_id);

    const announcementEmbed = new EmbedBuilder().setColor('#FFD700').setTitle(`🎉 Raffle Ended: ${raffle.title} 🎉`).setDescription(announcementDescription).setTimestamp();
    await channel.send({ content: winners.length > 0 ? winners.map(id => `<@${id}>`).join(' ') : ' ', embeds: [announcementEmbed] });

    const originalMessage = await channel.messages.fetch(raffle.message_id).catch(() => null);
    if (originalMessage) {
        const endedEmbed = EmbedBuilder.from(originalMessage.embeds[0]).setColor('#808080').addFields({ name: 'Status', value: 'This raffle has ended.'});
        const disabledRow = ActionRowBuilder.from(originalMessage.components[0]).setComponents(ButtonBuilder.from(originalMessage.components[0].components[0]).setDisabled(true));
        await originalMessage.edit({ embeds: [endedEmbed], components: [disabledRow] });
    }
    return { success: true, message: `Raffle ID ${raffleId} has been successfully ended.` };
}


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
        await interaction.update({ ...response });
    }

    if (interaction.isButton()) {
        const action = interaction.customId.split('_')[2];
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
                const channelId = interaction.fields.getTextInputValue('channel_input');
                const ticketCost = parseInt(interaction.fields.getTextInputValue('cost_input'), 10);
                const endDate = chrono.parseDate(durationStr, new Date(), { forwardDate: true });
                if (!endDate) return interaction.editReply({ content: 'Error: Invalid duration format.' });
                const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
                if (!channel || channel.type !== ChannelType.GuildText) return interaction.editReply({ content: 'Error: Invalid Channel ID.' });
                if (isNaN(numWinners) || numWinners < 1) return interaction.editReply({ content: 'Error: Number of winners must be at least 1.' });
                if (isNaN(ticketCost) || ticketCost < 0) return interaction.editReply({ content: 'Error: Ticket cost must be a positive number or 0.' });
                const endTimestamp = Math.floor(endDate.getTime() / 1000);
                const result = db.prepare('INSERT INTO raffles (guild_id, title, channel_id, ticket_cost, num_winners, end_timestamp, status) VALUES (?, ?, ?, ?, ?, ?, ?)').run(guildId, title, channel.id, ticketCost, numWinners, endTimestamp, 'active');
                const raffleId = result.lastInsertRowid;
                const raffleEmbed = new EmbedBuilder().setColor('#1ABC9C').setTitle(`🎟️ Raffle Started: ${title} 🎟️`).addFields({ name: '🏆 Winners', value: `**${numWinners}**`, inline: true }, { name: '🎫 Ticket Cost', value: `**${ticketCost.toLocaleString()}** Solyx™`, inline: true }, { name: '⏰ Ends', value: `${formatTimestamp(endTimestamp, 'R')}` }).setFooter({ text: `Raffle ID: ${raffleId}` });
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`raffle_buy_${raffleId}`).setLabel('Buy Ticket').setStyle(ButtonStyle.Success).setEmoji('🎫'));
                const raffleMessage = await channel.send({ embeds: [raffleEmbed], components: [row] });
                db.prepare('UPDATE raffles SET message_id = ? WHERE raffle_id = ?').run(raffleMessage.id, raffleId);
                await interaction.editReply({ content: `✅ Successfully created and announced the raffle in ${channel}!` });
            } catch (error) {
                console.error('[AdminRaffleCreate]', error);
                await interaction.editReply({ content: 'An error occurred while creating the raffle.' });
            }
        }
        if (customId === 'admin_raffle_modal_end') {
            await interaction.deferReply({ flags: 64 });
            const raffleId = parseInt(interaction.fields.getTextInputValue('raffle_id_input'), 10);
            if (isNaN(raffleId)) return interaction.editReply({ content: 'Invalid Raffle ID.' });
            const result = await drawRaffleWinners(interaction.client, raffleId);
            await interaction.editReply({ content: result.message });
        }
    }
};