// src/handlers/interactions/economy/claimHandler.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const claimManager = require('../../../managers/economy/claimManager');
const walletManager = require('../../../managers/economy/walletManager');
const { formatTimestamp } = require('../../../helpers/timestampFormatter');

module.exports = async (interaction) => {
    const customId = interaction.customId;
    const user = interaction.user;
    const guildId = interaction.guild.id;

    if (customId.startsWith('claim_daily_')) {
        if (user.id !== customId.split('_')[2]) return interaction.reply({ content: 'This is not for you!', flags: 64 });
        
        // --- Get balance BEFORE the transaction ---
        const oldBalance = walletManager.getConsolidatedBalance(user.id, guildId);
        const result = claimManager.claimDaily(user.id, guildId);

        if (result.success) {
            const { weekly_claim_state, nextClaim } = claimManager.getDailyStatus(user.id, guildId);
            const dailyRewardAmount = claimManager.getDailyReward(guildId);
            
            // --- Disable the original buttons and embed ---
            const updatedEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setAuthor({ name: `${user.displayName} | Daily Claim`, iconURL: user.displayAvatarURL() })
                .setDescription(`Claim your daily reward of **${dailyRewardAmount}** 🪙 once per calendar day.\nYour weekly progress is shown below.`)
                .setFooter({ text: 'Mythweaver Studios™ | /daily' });

            if (nextClaim) {
                updatedEmbed.description += `\n\nYou can claim again ${formatTimestamp(Math.floor(nextClaim.getTime() / 1000), 'R')}.`;
            }
            
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            updatedEmbed.addFields(days.map((day, index) => ({ name: day, value: weekly_claim_state[index] ? '✅' : '❌', inline: true })));
            
            const disabledButton = new ButtonBuilder()
                .setCustomId(`claim_daily_${user.id}`)
                .setLabel('Claim Daily Reward')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🪙')
                .setDisabled(true);
            
            await interaction.update({ embeds: [updatedEmbed], components: [new ActionRowBuilder().addComponents(disabledButton)] });
            
            // --- Send a new embed as a follow-up with balance details ---
            const confirmationEmbed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('Daily Reward Claimed!')
                .setDescription(`You have received **${result.reward.toLocaleString()}** Solyx™!`)
                .addFields(
                    { name: 'Old Balance', value: `${oldBalance.toLocaleString()} Solyx™`, inline: true },
                    { name: 'New Balance', value: `${result.newBalance.toLocaleString()} Solyx™`, inline: true }
                );

            await interaction.followUp({ embeds: [confirmationEmbed], flags: 64 });
        } else {
            await interaction.reply({ content: result.message, flags: 64 });
        }
    }

    if (customId.startsWith('claim_weekly_')) {
        if (user.id !== customId.split('_')[2]) return interaction.reply({ content: 'This is not for you!', flags: 64 });

        // --- Get balance BEFORE the transaction ---
        const oldBalance = walletManager.getConsolidatedBalance(user.id, guildId);
        const result = claimManager.claimWeekly(user.id, guildId);

        if (result.success) {
            // --- Update embed to show old and new balance ---
            const newEmbed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('Weekly Reward Claimed!')
                .setDescription(`You have received **${result.reward.toLocaleString()}** Solyx™!`)
                .addFields(
                    { name: 'Old Balance', value: `${oldBalance.toLocaleString()} Solyx™`, inline: true },
                    { name: 'New Balance', value: `${result.newBalance.toLocaleString()} Solyx™`, inline: true }
                );
            await interaction.update({ embeds: [newEmbed], components: [] });
        } else {
            const newEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('Claim Failed')
                .setDescription(result.message);
            await interaction.update({ embeds: [newEmbed], components: [] });
        }
    }
};