// commands/daily.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const economyManager = require('../utils/economyManager');
const { formatTimestamp } = require('../utils/timestampFormatter');
const { getDay } = require('date-fns');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily reward.'),
    async execute(interaction) {
        const guildId = interaction.guild.id;
        const { canClaim, weekly_claim_state, nextClaim } = economyManager.getDailyStatus(interaction.user.id, guildId);
        const user = interaction.user;

        const embed = new EmbedBuilder()
            .setColor(canClaim ? '#2ECC71' : '#E74C3C')
            .setAuthor({ name: `${user.displayName} | Daily Claim`, iconURL: user.displayAvatarURL() })
            .setDescription(`Claim your daily reward of **${economyManager.DAILY_REWARD}** 🪙 once per calendar day.\nYour weekly progress is shown below.`)
            .setFooter({ text: 'Mythweaver Studios™ | /daily' });

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayFields = days.map((day, index) => ({ name: day, value: weekly_claim_state[index] ? '✅' : '❌', inline: true }));
        embed.addFields(dayFields);

        let row;
        let isEphemeral = false;

        if (canClaim) {
            const claimButton = new ButtonBuilder()
                .setCustomId(`claim_daily_${user.id}`)
                .setLabel('Claim Daily Reward')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🪙')
                .setDisabled(false);
            row = new ActionRowBuilder().addComponents(claimButton);
        } else {
            embed.description += `\n\nYou can claim again ${formatTimestamp(Math.floor(nextClaim.getTime() / 1000), 'R')}.`;
            const navButtons = [
                new ButtonBuilder().setCustomId('nav_view_bank').setLabel('View Wallet').setStyle(ButtonStyle.Primary).setEmoji('🏦'),
                new ButtonBuilder().setCustomId('nav_view_shop').setLabel('View Shop').setStyle(ButtonStyle.Secondary).setEmoji('🛍️')
            ];
            row = new ActionRowBuilder().addComponents(navButtons);
            isEphemeral = true;
        }

        await interaction.reply({
            embeds: [embed],
            components: [row],
            flags: isEphemeral ? 64 : 0
        });
    },
};