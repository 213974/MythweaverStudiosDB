// src/handlers/interactions/economyInteractionHandler.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const economyManager = require('../../utils/economyManager');
const db = require('../../utils/database');
const { getDay } = require('date-fns');
const { formatTimestamp } = require('../../utils/timestampFormatter');

// --- Main Handler Function ---
module.exports = async (interaction) => {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;
    const user = interaction.user;
    const guildId = interaction.guild.id;

    // --- Claim Buttons ---
    if (customId.startsWith('claim_daily_')) {
        if (interaction.user.id !== customId.split('_')[2]) {
            return interaction.reply({ content: 'This is not for you!', flags: 64 });
        }

        const result = economyManager.claimDaily(user.id, guildId);

        if (result.success) {
            // Re-fetch status to build the updated embed with the '✅'
            const { weekly_claim_state, nextClaim } = economyManager.getDailyStatus(user.id, guildId);

            const updatedEmbed = new EmbedBuilder()
                .setColor('#E74C3C') // Red to indicate the claim for today has been used
                .setAuthor({ name: `${user.displayName} | Daily Claim`, iconURL: user.displayAvatarURL() })
                .setDescription(`Claim your daily reward of **${economyManager.DAILY_REWARD}** 🪙 once per calendar day.\nYour weekly progress is shown below.`)
                .setFooter({ text: 'Mythweaver Studios™ | /daily' });
            
            if (nextClaim) {
                updatedEmbed.description += `\n\nYou can claim again ${formatTimestamp(Math.floor(nextClaim.getTime() / 1000), 'R')}.`;
            }

            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const dayFields = days.map((day, index) => ({
                name: day,
                value: weekly_claim_state[index] ? '✅' : '❌',
                inline: true
            }));
            updatedEmbed.addFields(dayFields);

            const disabledButton = new ButtonBuilder()
                .setCustomId(`claim_daily_${user.id}`)
                .setLabel('Claim Daily Reward')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🪙')
                .setDisabled(true);

            const updatedRow = new ActionRowBuilder().addComponents(disabledButton);
            
            // Update the original public message with the correct embed and disabled button
            await interaction.update({ embeds: [updatedEmbed], components: [updatedRow] });
            
            // Send a private, ephemeral confirmation to the user
            await interaction.followUp({ content: `✅ **${result.reward.toLocaleString()}** Solyx™ has been added to your wallet.`, flags: 64 });

        } else {
            // Handle failure (e.g., already claimed from a rapid double-click, wallet full) with an ephemeral message
            await interaction.reply({ content: result.message, flags: 64 });
        }
        return; // Stop further execution in this handler
    }
    // TODO: Add weekly claim button logic here if needed

    // --- Post-Claim Navigation ---
    if (customId === 'view_bank_after_claim') { // Kept ID for compatibility with /daily command for now
        const wallet = economyManager.getWallet(user.id, guildId);
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
        const wallet = economyManager.getWallet(user.id, guildId);

        if (wallet.balance < raffle.ticket_cost) {
            return interaction.editReply({ content: `You need **${raffle.ticket_cost.toLocaleString()}** Solyx™ to buy a ticket, but you only have **${wallet.balance.toLocaleString()}**.` });
        }

        try {
            db.transaction(() => {
                db.prepare('UPDATE wallets SET balance = balance - ? WHERE user_id = ? AND guild_id = ?').run(raffle.ticket_cost, user.id, guildId);
                db.prepare('INSERT INTO raffle_entries (raffle_id, user_id) VALUES (?, ?)').run(raffleId, user.id);
                db.prepare('INSERT INTO transactions (user_id, guild_id, amount, reason, timestamp) VALUES (?, ?, ?, ?, ?)')
                    .run(user.id, guildId, -raffle.ticket_cost, `Raffle ticket purchase (ID: ${raffleId})`, new Date().toISOString());
            })(); // Immediately execute the transaction
            
            await interaction.editReply({ content: `✅ Success! You have purchased one ticket for the **${raffle.title}** raffle.` });
        } catch (error) {
            console.error(`[RaffleBuy] Failed to process ticket purchase for user ${user.id}:`, error);
            await interaction.editReply({ content: 'An error occurred while purchasing your ticket. Please try again.' });
        }
    }
};