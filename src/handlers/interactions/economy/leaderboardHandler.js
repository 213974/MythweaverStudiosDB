// src/handlers/interactions/economy/leaderboardHandler.js
const { EmbedBuilder } = require('discord.js');
const economyManager = require('../../../utils/economyManager');

module.exports = async (interaction) => {
    if (interaction.customId !== 'leaderboard_check_rank') return;
    
    const guildId = interaction.guild.id;
    const user = interaction.user;

    const userRank = economyManager.getUserRank(user.id, guildId);

    const embed = new EmbedBuilder();

    if (userRank) {
        embed
            .setColor('#3498DB')
            .setTitle('Your Leaderboard Rank')
            .setDescription(`You are currently **#${userRank.rank}** on the leaderboard with **${userRank.balance.toLocaleString()}** 🪙.`);
    } else {
        embed
            .setColor('#E74C3C')
            .setTitle('Not on Leaderboard')
            .setDescription('You do not have a rank yet. Earn some Solyx™ to get on the board!');
    }
    
    await interaction.reply({ embeds: [embed], flags: 64 });
};