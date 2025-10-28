// src/commands/donate.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const walletManager = require('../managers/economy/walletManager');
const { parseFlexibleAmount } = require('../helpers/interactionHelpers');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('donate')
        .setDescription('Donate Solyx™ to another user.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user you want to donate to.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('amount')
                .setDescription('The amount of Solyx™ to donate (e.g., 100, 2.5k).')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });

        const sender = interaction.user;
        const recipient = interaction.options.getUser('user');
        const amountStr = interaction.options.getString('amount');
        const amount = parseFlexibleAmount(amountStr);
        const guildId = interaction.guild.id;

        // --- Validation ---
        if (!recipient || !amount) {
            return interaction.editReply({ content: 'Invalid user or amount specified.' });
        }
        if (recipient.bot) {
            return interaction.editReply({ content: 'You cannot donate Solyx™ to a bot.' });
        }
        if (recipient.id === sender.id) {
            return interaction.editReply({ content: 'You cannot donate Solyx™ to yourself.' });
        }
        if (amount <= 0) {
            return interaction.editReply({ content: 'Donation amount must be a positive number.' });
        }
        
        // --- Transaction ---
        const reason = `Donation from ${sender.tag} to ${recipient.tag}`;
        const result = walletManager.transferSolyx(sender.id, recipient.id, guildId, amount, reason);
        
        if (result.success) {
            const embed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('💸 Donation Successful 💸')
                .setDescription(`You have successfully donated **${amount.toLocaleString()}** Solyx™ to ${recipient}.`)
                .setFooter({ text: 'Thank you for your generosity!' });

            await interaction.editReply({ embeds: [embed] });

            // --- Send a DM to the recipient ---
            try {
                const recipientEmbed = new EmbedBuilder()
                    .setColor('#3498DB')
                    .setTitle('🎉 You\'ve Received a Donation! 🎉')
                    .setDescription(`${sender} has donated **${amount.toLocaleString()}** Solyx™ to you in the **${interaction.guild.name}** server!`);
                await recipient.send({ embeds: [recipientEmbed] });
            } catch (error) {
                console.warn(`[Donate] Could not DM recipient ${recipient.tag}:`, error.message);
            }
        } else {
            await interaction.editReply({ content: `Donation failed: ${result.message}` });
        }
    },
};