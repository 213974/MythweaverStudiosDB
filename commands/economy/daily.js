// commands/economy/daily.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const economyManager = require('../../utils/economyManager');
const { getDay } = require('date-fns');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Check your daily reward status.'),
    async execute(interaction) {
        const { canClaim, weekly_claim_state } = economyManager.getDailyStatus(interaction.user.id);
        const todayIndex = getDay(new Date());

        const embed = new EmbedBuilder()
            .setColor(canClaim ? '#2ECC71' : '#E74C3C')
            .setTitle('Daily Reward')
            .setDescription(`Claim your daily reward of **${economyManager.DAILY_REWARD}** 🪙 once per day.\nYour weekly progress is shown below.`);

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayFields = days.map((day, index) => ({
            name: day,
            value: weekly_claim_state[index] ? '✅' : '❌',
            inline: true
        }));
        embed.addFields(dayFields);

        const claimButton = new ButtonBuilder()
            .setCustomId('claim_daily_reward')
            .setLabel('Claim Daily Reward')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🪙')
            .setDisabled(!canClaim);

        const row = new ActionRowBuilder().addComponents(claimButton);

        const reply = await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

        const collector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'This is not for you!', ephemeral: true });
            }
            if (i.customId === 'claim_daily_reward') {
                const result = economyManager.claimDaily(i.user.id);

                const newEmbed = new EmbedBuilder();
                const newButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('view_bank_after_claim').setLabel('View Bank').setStyle(ButtonStyle.Primary).setEmoji('🏦'),
                    new ButtonBuilder().setCustomId('view_shop_after_claim').setLabel('View Shop').setStyle(ButtonStyle.Secondary).setEmoji('🛍️')
                );

                if (result.success) {
                    newEmbed.setColor('#00FF00')
                        .setTitle('Daily Reward Claimed!')
                        .setDescription(`**${result.reward}** 🪙 has been deposited directly into your bank.`)
                        .setFooter({ text: 'This Gold is safe in your bank. Use /bank withdraw to move it to your balance.' });
                } else {
                    newEmbed.setColor('#FF0000')
                        .setTitle('Claim Failed')
                        .setDescription(result.message);
                }

                await i.update({ embeds: [newEmbed], components: [newButtons] });
                collector.stop();
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                const expiredRow = new ActionRowBuilder().addComponents(claimButton.setDisabled(true).setLabel('Expired'));
                interaction.editReply({ components: [expiredRow] }).catch(() => { });
            }
        });
    },
};