// src/commands/clan/subcommands/color.js
const { EmbedBuilder } = require('discord.js');

function isValidHexColor(hex) {
    return /^#[0-9A-F]{6}$/i.test(hex);
}

module.exports = {
    async execute(interaction, userClanData, permissions) {
        if (!permissions.isOwner) {
            return interaction.reply({ content: 'Only the Clan Owner can change the clan role color.', ephemeral: true });
        }
        
        const hexColorInput = interaction.options.getString('hexcolor');
        if (!isValidHexColor(hexColorInput)) {
            return interaction.reply({ content: `Invalid hex color: \`${hexColorInput}\`. Please use the #RRGGBB format.`, ephemeral: true });
        }
        
        try {
            const clanDiscordRole = await interaction.guild.roles.fetch(userClanData.clanRoleId);
            await clanDiscordRole.setColor(hexColorInput);
            const embed = new EmbedBuilder().setColor(hexColorInput).setTitle('🎨 Clan Role Color Updated!').setDescription(`Color for **${clanDiscordRole.name}** changed to **${hexColorInput}**.`);
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error(`[Clan Color] Failed to change color:`, error);
            await interaction.reply({ content: `An error occurred. I might lack permission to manage the role.`, ephemeral: true });
        }
    }
};