// src/commands/donate.js
const { SlashCommandBuilder, EmbedBuilder, Collection } = require('discord.js');
const walletManager = require('../managers/economy/walletManager');
const { parseFlexibleAmount } = require('../helpers/interactionHelpers');

const DONATE_COOLDOWN_SECONDS = 10 * 60; // 10 minutes

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
        const sender = interaction.user;

        // --- Cooldown Check ---
        const cooldowns = interaction.client.cooldowns.get('donate') || new Collection();
        const now = Date.now();
        const userTimestamp = cooldowns.get(sender.id);
        const expirationTime = userTimestamp + DONATE_COOLDOWN_SECONDS * 1000;

        if (userTimestamp && now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            return interaction.reply({ content: `You can use the donate command again in ${Math.ceil(timeLeft / 60)} minute(s).`, flags: 64 });
        }

        await interaction.deferReply({ flags: 64 });

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
            // Set cooldown on successful donation
            cooldowns.set(sender.id, now);
            interaction.client.cooldowns.set('donate', cooldowns);
            setTimeout(() => cooldowns.delete(sender.id), DONATE_COOLDOWN_SECONDS * 1000);

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
                    .setTitle('🎉 You\'ve Received Solyx! 🎉')
                    .setDescription(`${sender} has donated **${amount.toLocaleString()}** Solyx™ to you!`);
                await recipient.send({ embeds: [recipientEmbed] });
            } catch (error) {
                console.warn(`[Donate] Could not DM recipient ${recipient.tag}:`, error.message);
            }
        } else {
            await interaction.editReply({ content: `Donation failed: ${result.message}` });
        }
    },
};