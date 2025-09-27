// src/handlers/interactions/economy/raffleHandler.js
const { EmbedBuilder } = require('discord.js');
const economyManager = require('../../../utils/economyManager');
const db = require('../../../utils/database');

module.exports = async (interaction) => {
    const customId = interaction.customId;

    if (customId.startsWith('raffle_buy_')) {
        const raffleId = customId.split('_')[2];
        const raffle = db.prepare('SELECT * FROM raffles WHERE raffle_id = ? AND status = ?').get(raffleId, 'active');
        if (!raffle) {
            if (interaction.message.components.length > 0) await interaction.update({ content: 'This raffle has ended.', components: [] }).catch(() => {});
            return interaction.followUp({ content: 'Could not enter the raffle as it has already ended.', flags: 64 });
        }
        await interaction.deferReply({ flags: 64 });
        const wallet = economyManager.getWallet(interaction.user.id, interaction.guild.id);
        if (wallet.balance < raffle.ticket_cost) {
            return interaction.editReply({ content: `You need **${raffle.ticket_cost.toLocaleString()}** Solyx™ to buy a ticket, but you only have **${wallet.balance.toLocaleString()}**.` });
        }
        try {
            db.transaction(() => {
                db.prepare('UPDATE wallets SET balance = balance - ? WHERE user_id = ? AND guild_id = ?').run(raffle.ticket_cost, interaction.user.id, interaction.guild.id);
                db.prepare('INSERT INTO raffle_entries (raffle_id, user_id) VALUES (?, ?)').run(raffleId, interaction.user.id);
                db.prepare('INSERT INTO transactions (user_id, guild_id, amount, reason, timestamp) VALUES (?, ?, ?, ?, ?)')
                    .run(interaction.user.id, interaction.guild.id, -raffle.ticket_cost, `Raffle ticket purchase (ID: ${raffleId})`, new Date().toISOString());
            })();
            await interaction.editReply({ content: `✅ Success! You have purchased one ticket for the **${raffle.title}** raffle.` });
            interaction.client.raffleUpdateQueue.add(raffleId);
        } catch (error) {
            console.error(`[RaffleBuy] Failed to process ticket purchase for user ${interaction.user.id}:`, error);
            await interaction.editReply({ content: 'An error occurred while purchasing your ticket. Please try again.' });
        }
    }

    if (customId.startsWith('raffle_entries_')) {
        const raffleId = customId.split('_')[2];
        const counts = db.prepare('SELECT COUNT(*) as total_entries, COUNT(DISTINCT user_id) as unique_entrants FROM raffle_entries WHERE raffle_id = ?').get(raffleId);
        const embed = new EmbedBuilder().setColor('#3498DB').setTitle('Raffle Statistics').addFields({ name: 'Unique Participants', value: `**${(counts.unique_entrants || 0).toLocaleString()}**`, inline: true }, { name: 'Total Tickets Sold', value: `**${(counts.total_entries || 0).toLocaleString()}**`, inline: true });
        await interaction.reply({ embeds: [embed], flags: 64 });
    }
};