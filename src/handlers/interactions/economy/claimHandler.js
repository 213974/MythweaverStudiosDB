// src/handlers/interactions/economy/claimHandler.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const economyManager = require('../../../utils/economyManager');
const { formatTimestamp } = require('../../../utils/timestampFormatter');

module.exports = async (interaction) => {
    const customId = interaction.customId;
    const user = interaction.user;
    const guildId = interaction.guild.id;

    if (customId.startsWith('claim_daily_')) {
        if (user.id !== customId.split('_')[2]) return interaction.reply({ content: 'This is not for you!', flags: 64 });
        
        const result = economyManager.claimDaily(user.id, guildId);
        if (result.success) {
            const { weekly_claim_state, nextClaim } = economyManager.getDailyStatus(user.id, guildId);
            
            // --- Fetch dynamic reward amount for the embed text ---
            const dailyRewardAmount = economyManager.getDailyReward(guildId);
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
            
            // A button click on an ephemeral message must be acknowledged with a new message or a defer.
            // Using editReply on the original message is the most intuitive user experience.
            await interaction.update({ embeds: [updatedEmbed], components: [new ActionRowBuilder().addComponents(disabledButton)] });
            
            // Send the success confirmation as a follow-up.
            await interaction.followUp({ content: `✅ **${result.reward.toLocaleString()}** Solyx™ has been added to your wallet.`, flags: 64 });
        } else {
            await interaction.reply({ content: result.message, flags: 64 });
        }
    }

    if (customId.startsWith('claim_weekly_')) {
        if (user.id !== customId.split('_')[2]) return interaction.reply({ content: 'This is not for you!', flags: 64 });

        const result = economyManager.claimWeekly(user.id, guildId);
        const newEmbed = new EmbedBuilder();
        const navButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('nav_view_bank').setLabel('View Wallet').setStyle(ButtonStyle.Primary).setEmoji('🏦'), 
            new ButtonBuilder().setCustomId('nav_view_shop').setLabel('View Shop').setStyle(ButtonStyle.Secondary).setEmoji('🛍️')
        );
        
        if (result.success) {
            newEmbed.setColor('#2ECC71')
                .setTitle('Weekly Reward Claimed!')
                .setDescription(`**${result.reward.toLocaleString()}** Solyx™ has been added to your wallet.`);
        } else {
            newEmbed.setColor('#E74C3C')
                .setTitle('Claim Failed')
                .setDescription(result.message);
        }
        await interaction.update({ embeds: [newEmbed], components: [navButtons] });
    }
};