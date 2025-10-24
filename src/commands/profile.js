// src/commands/profile.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const economyManager = require('../managers/economyManager');
const userManager = require('../managers/userManager');
const moment = require('moment');
require('moment-duration-format');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Displays your or another user\'s server profile.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to view the profile of.')
                .setRequired(false)),
    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) {
            return interaction.editReply({ content: 'Could not find that member in this server.' });
        }
        
        // 1. Fetch all required data
        const totalSolyx = economyManager.getConsolidatedBalance(targetUser.id, interaction.guild.id);
        const userStats = userManager.getUserStats(targetUser.id, interaction.guild.id);
        
        // 2. Perform calculations
        const levelData = userManager.calculateLevel(totalSolyx);
        const progressBar = userManager.createProgressBar(levelData.progress);
        const highestRole = member.roles.highest;
        const vcTimeFormatted = moment.duration(userStats.total_vc_time_ms).format("D[d] H[h] m[m]");

        // 3. Build the embed
        const profileEmbed = new EmbedBuilder()
            .setColor(highestRole.color || '#95A5A6')
            .setAuthor({ name: `${targetUser.displayName}'s Profile`, iconURL: targetUser.displayAvatarURL() })
            .setThumbnail(targetUser.displayAvatarURL())
            .addFields(
                {
                    name: `🌟 Level ${levelData.level}`,
                    value: `\`${progressBar}\`\n*${Math.floor(levelData.xpInCurrentLevel).toLocaleString()} / ${Math.floor(levelData.xpNeededForNextLevel).toLocaleString()} Solyx™ to next level*`,
                    inline: false
                },
                { name: '🏆 Highest Role', value: `${highestRole}`, inline: true },
                { name: '🎙️ Time in Voice Chat', value: `> ${vcTimeFormatted}`, inline: true },
                { name: '💰 Total Solyx™ Balance', value: `> ${totalSolyx.toLocaleString()} <a:Yellow_Gem:1427764380489224295>`, inline: false },
                { name: '💬 Solyx™ from Messages', value: `> ${userStats.total_solyx_from_messages.toLocaleString()}`, inline: true },
                { name: '🎤 Solyx™ from Voice', value: `> ${userStats.total_solyx_from_vc.toLocaleString()}`, inline: true },
            )
            .setFooter({ text: `User ID: ${targetUser.id}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [profileEmbed] });
    },
};