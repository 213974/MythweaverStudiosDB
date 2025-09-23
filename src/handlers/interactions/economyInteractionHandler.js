// src/handlers/interactions/economyInteractionHandler.js
const { EmbedBuilder } = require('discord.js');
const economyManager = require('../../utils/economyManager');
const db = require('../../utils/database');

// --- Main Handler Function ---
module.exports = async (interaction) => {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;
    const user = interaction.user;

    // --- Claim Buttons ---
    if (customId.startsWith('claim_daily_')) {
        if (interaction.user.id !== customId.split('_')[2]) {
            return interaction.reply({ content: 'This is not for you!', flags: 64 });
        }

        await interaction.update({ components: [] }); // Disable button immediately
        const result = economyManager.claimDaily(user.id);
        const embed = new EmbedBuilder();

        if (result.success) {
            embed.setColor('#2ECC71').setTitle('Daily Reward Claimed!').setDescription(`**${result.reward.toLocaleString()}** Solyx™ has been added to your wallet.`);
        } else {
            embed.setColor('#E74C3C').setTitle('Claim Failed').setDescription(result.message);
        }
        // Use followUp for the ephemeral message after the button is disabled
        return interaction.followUp({ embeds: [embed], flags: 64 });
    }
    // TODO: Add weekly claim button logic here if needed

    // --- Post-Claim Navigation ---
    if (customId === 'view_bank_after_claim') { // Kept ID for compatibility with /daily command for now
        const wallet = economyManager.getWallet(user.id);
        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setAuthor({ name: `${user.displayName}'s Wallet`, iconURL: user.displayAvatarURL() })
            .addFields(
                { name: 'Balance', value: `> ${wallet.balance.toLocaleString()} Solyx™`, inline: true },
                { name: 'Capacity', value: `> ${wallet.capacity.toLocaleString()} Solyx™`, inline: true }
            );
        // Using update() because this is a response to a button press
        await interaction.update({ embeds: [embed], components: [] });
    }

    if (customId === 'view_shop_after_claim') {
        const shopCommand = interaction.client.commands.get('shop');
        // We deferUpdate to acknowledge the button press, then have the shop command send a new ephemeral reply
        await interaction.deferUpdate();
        await shopCommand.execute(interaction);
    }

    // --- Raffle Entry Button ---
    if (customId.startsWith('raffle_buy_')) {
        const raffleId = customId.split('_')[2];
        const raffle = db.prepare('SELECT * FROM raffles WHERE raffle_id = ? AND status = ?').get(raffleId, 'active');

        if (!raffle) {
            // Edit the original message to show the raffle ended, if possible
            if (interaction.message.components.length > 0) {
                 await interaction.update({ content: 'This raffle has ended.', components: [] }).catch(() => {});
            }
            return interaction.followUp({ content: 'Could not enter the raffle as it has already ended.', flags: 64 });
        }

        await interaction.deferReply({ flags: 64 });
        const wallet = economyManager.getWallet(user.id);

        if (wallet.balance < raffle.ticket_cost) {
            return interaction.editReply({ content: `You need **${raffle.ticket_cost.toLocaleString()}** Solyx™ to buy a ticket, but you only have **${wallet.balance.toLocaleString()}**.` });
        }

        try {
            db.transaction(() => {
                db.prepare('UPDATE wallets SET balance = balance - ? WHERE user_id = ?').run(raffle.ticket_cost, user.id);
                db.prepare('INSERT INTO raffle_entries (raffle_id, user_id) VALUES (?, ?)').run(raffleId, user.id);
                db.prepare('INSERT INTO transactions (user_id, amount, reason, timestamp) VALUES (?, ?, ?, ?)')
                    .run(user.id, -raffle.ticket_cost, `Raffle ticket purchase (ID: ${raffleId})`, new Date().toISOString());
            })(); // Immediately execute the transaction
            
            await interaction.editReply({ content: `✅ Success! You have purchased one ticket for the **${raffle.title}** raffle.` });
        } catch (error) {
            console.error(`[RaffleBuy] Failed to process ticket purchase for user ${user.id}:`, error);
            await interaction.editReply({ content: 'An error occurred while purchasing your ticket. Please try again.' });
        }
    }
};