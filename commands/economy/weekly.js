// commands/economy/weekly.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const economyManager = require('../../utils/economyManager');
const { formatTimestamp } = require('../../utils/timestampFormatter');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weekly')
        .setDescription('Claim your weekly Gold reward.'),
    async execute(interaction) {
        const { canClaim, nextClaim } = economyManager.canClaimWeekly(interaction.user.id);

        const embed = new EmbedBuilder().setTitle('Weekly Reward');

        const claimButton = new ButtonBuilder()
            .setCustomId('claim_weekly_reward')
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
        const reply = await interaction.reply({ embeds: [embed], components: [row], flags: 64, fetchReply: true });

        const collector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

        collector.on('collect', async i => {
            if (i.customId === 'claim_weekly_reward') {
                const result = economyManager.claimWeekly(i.user.id);

                const newEmbed = new EmbedBuilder();
                const newButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('view_bank').setLabel('View Bank').setStyle(ButtonStyle.Primary).setEmoji('🏦'),
                    new ButtonBuilder().setCustomId('view_shop').setLabel('View Shop').setStyle(ButtonStyle.Secondary).setEmoji('🛍️')
                );

                if (result.success) {
                    newEmbed.setColor('#00FF00')
                        .setTitle('Weekly Reward Claimed!')
                        .setDescription(`**${result.reward}** 💎 has been deposited directly into your bank.`)
                        .setFooter({ text: 'The Gold is safe in your bank. Use `/bank withdraw` to move it to your pockets to buy things.' });
                } else {
                    newEmbed.setColor('#FF0000')
                        .setTitle('Claim Failed')
                        .setDescription(result.message);
                }

                await i.update({ embeds: [newEmbed], components: [newButtons] });
                collector.stop();
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                const expiredRow = new ActionRowBuilder().addComponents(claimButton.setDisabled(true));
                interaction.editReply({ components: [expiredRow] }).catch(() => { });
            }
        });
    },
};