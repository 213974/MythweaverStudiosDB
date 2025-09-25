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
            const dayFields = days.map((day, index) => ({ name: day, value: weekly_claim_state[index] ? '✅' : '❌', inline: true }));
            updatedEmbed.addFields(dayFields);

            const disabledButton = new ButtonBuilder().setCustomId(`claim_daily_${user.id}`).setLabel('Claim Daily Reward').setStyle(ButtonStyle.Success).setEmoji('🪙').setDisabled(true);
            const updatedRow = new ActionRowBuilder().addComponents(disabledButton);
            
            await interaction.update({ embeds: [updatedEmbed], components: [updatedRow] });
            await interaction.followUp({ content: `✅ **${result.reward.toLocaleString()}** Solyx™ has been added to your wallet.`, flags: 64 });
        } else {
            await interaction.reply({ content: result.message, flags: 64 });
        }
        return;
    }

    if (customId.startsWith('claim_weekly_')) {
        if (interaction.user.id !== customId.split('_')[2]) {
            return interaction.reply({ content: 'This is not for you!', flags: 64 });
        }

        const result = economyManager.claimWeekly(user.id, guildId);
        const newEmbed = new EmbedBuilder();
        
        const navButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('nav_view_bank').setLabel('View Wallet').setStyle(ButtonStyle.Primary).setEmoji('🏦'),
            new ButtonBuilder().setCustomId('nav_view_shop').setLabel('View Shop').setStyle(ButtonStyle.Secondary).setEmoji('🛍️')
        );

        if (result.success) {
            newEmbed.setColor('#2ECC71').setTitle('Weekly Reward Claimed!').setDescription(`**${result.reward.toLocaleString()}** Solyx™ has been added to your wallet.`);
        } else {
            newEmbed.setColor('#E74C3C').setTitle('Claim Failed').setDescription(result.message);
        }

        await interaction.update({ embeds: [newEmbed], components: [navButtons] });
        return;
    }

    // --- Post-Claim Navigation ---
    if (customId === 'nav_view_bank') {
        const wallet = economyManager.getWallet(user.id, guildId);
        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setAuthor({ name: `${user.displayName}'s Wallet`, iconURL: user.displayAvatarURL() })
            .addFields(
                { name: 'Balance', value: `> ${wallet.balance.toLocaleString()} Solyx™`, inline: true },
                { name: 'Capacity', value: `> ${wallet.capacity.toLocaleString()} Solyx™`, inline: true }
            );
        await interaction.update({ embeds: [embed], components: [] });
    }

    if (customId === 'nav_view_shop') {
        const shopCommand = interaction.client.commands.get('shop');
        await interaction.deferUpdate();
        await shopCommand.execute(interaction);
    }

    // --- Raffle Entry Button ---
    if (customId.startsWith('raffle_buy_')) {
        const raffleId = customId.split('_')[2];
        const raffle = db.prepare('SELECT * FROM raffles WHERE raffle_id = ? AND status = ?').get(raffleId, 'active');

        if (!raffle) {
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
            })();
            
            await interaction.editReply({ content: `✅ Success! You have purchased one ticket for the **${raffle.title}** raffle.` });

            // Update participant count on original message
            const entryCount = db.prepare('SELECT COUNT(DISTINCT user_id) as count FROM raffle_entries WHERE raffle_id = ?').get(raffleId).count;
            const originalMessage = interaction.message;
            if (originalMessage && originalMessage.components.length > 0) {
                const updatedRow = ActionRowBuilder.from(originalMessage.components[0]);
                const participantsButton = updatedRow.components.find(c => c.customId === `raffle_entries_${raffleId}`);
                if (participantsButton) {
                    participantsButton.setLabel(`Participants: ${entryCount}`);
                    await originalMessage.edit({ components: [updatedRow] });
                }
            }
        } catch (error) {
            console.error(`[RaffleBuy] Failed to process ticket purchase for user ${user.id}:`, error);
            await interaction.editReply({ content: 'An error occurred while purchasing your ticket. Please try again.' });
        }
    }

    // --- Raffle Info Button ---
    if (customId.startsWith('raffle_entries_')) {
        const raffleId = customId.split('_')[2];
        const counts = db.prepare('SELECT COUNT(*) as total_entries, COUNT(DISTINCT user_id) as unique_entrants FROM raffle_entries WHERE raffle_id = ?').get(raffleId);

        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle('Raffle Statistics')
            .addFields(
                { name: 'Unique Participants', value: `**${(counts.unique_entrants || 0).toLocaleString()}**`, inline: true },
                { name: 'Total Tickets Sold', value: `**${(counts.total_entries || 0).toLocaleString()}**`, inline: true }
            );
        
        await interaction.reply({ embeds: [embed], flags: 64 });
    }
};