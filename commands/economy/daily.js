// commands/economy/daily.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const economyManager = require('../../utils/economyManager');
const { formatTimestamp } = require('../../utils/timestampFormatter');
const { getDay } = require('date-fns');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily reward.'),
    async execute(interaction) {
        const { canClaim, weekly_claim_state, nextClaim } = economyManager.getDailyStatus(interaction.user.id);
        const user = interaction.user;

        const embed = new EmbedBuilder()
            .setColor(canClaim ? '#2ECC71' : '#E74C3C')
            .setAuthor({ name: `${user.displayName}'s Daily Claim`, iconURL: user.displayAvatarURL() })
            .setDescription(`Claim your daily reward of **${economyManager.DAILY_REWARD}** 🪙 once per calendar day.\nYour weekly progress is shown below.`)
            .setFooter({ text: 'Mythweaver Studios™ | /daily' });

        if (!canClaim) {
            embed.description += `\n\nYou can claim again ${formatTimestamp(Math.floor(nextClaim.getTime() / 1000), 'R')}.`;
        }

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayFields = days.map((day, index) => ({
            name: day,
            value: weekly_claim_state[index] ? '✅' : '❌',
            inline: true
        }));
        embed.addFields(dayFields);

        const claimButton = new ButtonBuilder()
            .setCustomId(`claim_daily_${user.id}`) // User-specific ID
            .setLabel('Claim Daily Reward')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🪙')
            .setDisabled(!canClaim);

        const row = new ActionRowBuilder().addComponents(claimButton);

        const reply = await interaction.reply({ embeds: [embed], components: canClaim ? [row] : [] });

        if (!canClaim) return;

        const collector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'This is not for you! Please run `/daily` yourself.', flags: 64 });
            }

            // Immediately disable the button on the original message to prevent double-clicks
            const disabledRow = new ActionRowBuilder().addComponents(claimButton.setDisabled(true));
            await i.update({ components: [disabledRow] });

            const result = economyManager.claimDaily(i.user.id);

            // Send a NEW, EPHEMERAL follow-up message with the results
            const followUpEmbed = new EmbedBuilder();
            const followUpButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('view_bank_after_claim').setLabel('View Bank').setStyle(ButtonStyle.Primary).setEmoji('🏦'),
                new ButtonBuilder().setCustomId('view_shop_after_claim').setLabel('View Shop').setStyle(ButtonStyle.Secondary).setEmoji('🛍️')
            );

            if (result.success) {
                followUpEmbed.setColor('#00FF00')
                    .setTitle('Daily Reward Claimed!')
                    .setDescription(`**${result.reward}** 🪙 has been deposited directly into your bank.`)
                    .setFooter({ text: 'This Gold is safe in your bank. Use /bank withdraw to move it to your pockets(balance).' });

                // Now, update the original public message to show the successful claim
                const todayIndex = getDay(new Date());
                dayFields[todayIndex].value = '✅'; // Update the checkmark
                const finalPublicEmbed = EmbedBuilder.from(embed).setFields(dayFields).setColor('#E74C3C');
                await interaction.editReply({ embeds: [finalPublicEmbed], components: [] });

            } else {
                followUpEmbed.setColor('#FF0000')
                    .setTitle('Claim Failed')
                    .setDescription(result.message);

                // If claim failed, re-enable the button on the original message
                const enabledRow = new ActionRowBuilder().addComponents(claimButton.setDisabled(false));
                await interaction.editReply({ components: [enabledRow] });
            }

            await i.followUp({ embeds: [followUpEmbed], components: [followUpButtons], flags: 64 });
            collector.stop();
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                interaction.editReply({ components: [] }).catch(() => { });
            }
        });
    },
};