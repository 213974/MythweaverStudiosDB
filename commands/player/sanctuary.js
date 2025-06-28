// commands/player/sanctuary.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const economyManager = require('../../utils/economyManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sanctuary')
        .setDescription('View your personal Sanctuary.')
        .addStringOption(option =>
            option.setName('visibility')
                .setDescription('Choose who can see this message. Defaults to Private.')
                .setRequired(false)
                .addChoices(
                    { name: 'Private (Only Me)', value: 'private' },
                    { name: 'Public (Everyone)', value: 'public' }
                )),

    async execute(interaction) {
        const visibility = interaction.options.getString('visibility') ?? 'private';
        const isPublic = visibility === 'public';
        const user = interaction.user;

        const wallet = economyManager.getWallet(user.id, 'Gold');

        const embed = new EmbedBuilder()
            .setColor('#58D68D')
            .setAuthor({ name: `${user.username}'s Sanctuary ⛩️`, iconURL: user.displayAvatarURL() })
            .addFields(
                { name: 'Sanctuary Balance', value: `> ${wallet.balance.toLocaleString()} 🪙`, inline: true },
                { name: 'Max Capacity', value: `> ${wallet.sanctuary_capacity.toLocaleString()} 🪙`, inline: true }
            )
            .setFooter({ text: 'This is your private reserve for your future champions & you to use for buying them things.' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('nav_view_bank').setLabel('View Player Bank').setStyle(ButtonStyle.Secondary).setEmoji('🏦')
        );

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: !isPublic });
    },
};