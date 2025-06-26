// commands/economy/balance.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const economyManager = require('../../utils/economyManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription("Check a user's on-hand Gold balance.")
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user whose balance you want to check. Defaults to yourself.')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('public')
                .setDescription('Set to true to show this to everyone. Defaults to false (visible only to you).')
                .setRequired(false)),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const isPublic = interaction.options.getBoolean('public') ?? false;

        if (targetUser.id !== interaction.user.id) {
            // If checking another user, just show the balance without buttons
            const wallet = economyManager.getWallet(targetUser.id, 'Gold');
            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setAuthor({ name: `${targetUser.username}'s Wallet`, iconURL: targetUser.displayAvatarURL() })
                .addFields({ name: 'On-Hand Balance', value: `${wallet.balance.toLocaleString()} 🪙` });

            const replyOptions = { embeds: [embed] };
            if (!isPublic) {
                replyOptions.flags = 64; // Ephemeral flag
            }
            return interaction.reply(replyOptions);
        }

        // If checking self, show interactive buttons
        const wallet = economyManager.getWallet(interaction.user.id, 'Gold');
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setAuthor({ name: `${interaction.user.username}'s Wallet`, iconURL: interaction.user.displayAvatarURL() })
            .addFields({ name: 'On-Hand Balance', value: `${wallet.balance.toLocaleString()} 🪙` })
            .setFooter({ text: 'This is the Gold you can spend and donate. Use /bank to see your saved Gold.' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('nav_view_bank').setLabel('View Bank').setStyle(ButtonStyle.Primary).setEmoji('🏦')
        );

        const replyOptions = { embeds: [embed], components: [row] };
        if (!isPublic) {
            replyOptions.flags = 64; // Ephemeral flag
        }
        await interaction.reply(replyOptions);
    },
};