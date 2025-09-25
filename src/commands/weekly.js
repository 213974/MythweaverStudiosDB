// commands/economy/weekly.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const economyManager = require('../utils/economyManager');
const { formatTimestamp } = require('../utils/timestampFormatter');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weekly')
        .setDescription('Claim your weekly Solyx reward.'),
    async execute(interaction) {
        const guildId = interaction.guild.id;
        const { canClaim, nextClaim } = economyManager.canClaimWeekly(interaction.user.id, guildId);
        const user = interaction.user;

        const embed = new EmbedBuilder()
            .setAuthor({ name: `${user.displayName} | Weekly Claim`, iconURL: user.displayAvatarURL() });

        const claimButton = new ButtonBuilder()
            .setCustomId(`claim_weekly_${user.id}`)
            .setLabel('Claim Weekly Reward')
            .setStyle(ButtonStyle.Success)
            .setEmoji('💎')
            .setDisabled(!canClaim);

        if (canClaim) {
            embed.setColor('#2ECC71')
                .setDescription(`You are eligible to claim your weekly reward of **${economyManager.WEEKLY_REWARD}** 💎!`);
        } else {
            embed.setColor('#E74C3C')
                .setDescription(`You have already claimed your weekly reward. You can claim again ${formatTimestamp(Math.floor(nextClaim.getTime() / 1000), 'R')}.`);
        }

        const row = new ActionRowBuilder().addComponents(claimButton);
        await interaction.reply({ embeds: [embed], components: canClaim ? [row] : [], flags: 64 });
    },
};