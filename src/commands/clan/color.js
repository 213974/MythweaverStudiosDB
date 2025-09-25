// src/commands/clan/color.js
const { EmbedBuilder } = require('discord.js');

function isValidHexColor(hex) {
    return /^#[0-9A-F]{6}$/i.test(hex);
}

module.exports = {
    async execute(interaction, guildId, userClanData, permissions) {
        if (!permissions.isOwner) {
            return interaction.reply({ content: 'Only the Clan Owner can change the clan role color.', flags: 64 });
        }
        
        const hexColorInput = interaction.options.getString('hexcolor');
        if (!isValidHexColor(hexColorInput)) {
            return interaction.reply({ content: `Invalid hex color: \`${hexColorInput}\`. Please use the #RRGGBB format.`, flags: 64 });
        }
        
        try {
            const clanDiscordRole = await interaction.guild.roles.fetch(userClanData.clanRoleId);
            
            // --- THIS IS THE CORRECTED LINE ---
            // Using the modern .edit() method to avoid the deprecation warning.
            await clanDiscordRole.edit({ color: hexColorInput });

            const embed = new EmbedBuilder()
                .setColor(hexColorInput)
                .setTitle('🎨 Clan Role Color Updated! 🎨')
                .setDescription(`Color for **${clanDiscordRole.name}** has been changed to **${hexColorInput}**.`);
            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error(`[Clan Color] Failed to change color:`, error);
            await interaction.reply({ content: `An error occurred. I might lack the permission or be lower in the role hierarchy than the clan role.`, flags: 64 });
        }
    }
};