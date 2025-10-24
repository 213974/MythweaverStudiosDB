// commands/economy/weekly.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const economyManager = require('../managers/economyManager');
const { formatTimestamp } = require('../helpers/timestampFormatter');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weekly')
        .setDescription('Claim your weekly Solyx reward.'),
    async execute(interaction) {
        const guildId = interaction.guild.id;
        const weeklyRewardAmount = economyManager.getWeeklyReward(guildId);
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
                .setDescription(`You are eligible to claim your weekly reward of **${weeklyRewardAmount}** 💎!`);
        } else {
            embed.setColor('#E74C3C')
                .setDescription(`You have already claimed your weekly reward. You can claim again ${formatTimestamp(Math.floor(nextClaim.getTime() / 1000), 'R')}.`);
        }

        const row = new ActionRowBuilder().addComponents(claimButton);
        
        // We now *always* use interaction.reply() because the interaction passed to this
        // command (from the quick action handler or a direct slash command) will always
        // be a fresh, unacknowledged one. This simplifies the logic immensely.
        await interaction.reply({
            embeds: [embed],
            components: canClaim ? [row] : [],
            flags: 64
        });
    },
};