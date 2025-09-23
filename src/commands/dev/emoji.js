// src/commands/dev/emoji.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('emoji')
        .setDescription('Gets the ID and formatted string for a custom emoji. [BOT OWNER ONLY]')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('emoji')
                .setDescription('The custom emoji you want to inspect.')
                .setRequired(true)),
    async execute(interaction) {
        if (interaction.user.id !== config.ownerID) {
            return interaction.reply({
                content: 'Solo Only `:D`',
                flags: 64
            });
        }

        const emojiStr = interaction.options.getString('emoji');
        const emojiRegex = /<a?:(.+?):(\d+?)>/;
        const match = emojiStr.match(emojiRegex);

        if (!match) {
            return interaction.reply({
                content: 'That does not appear to be a valid custom emoji. Please provide the emoji itself.',
                flags: 64
            });
        }

        const emojiName = match[1];
        const emojiId = match[2];
        const isAnimated = emojiStr.startsWith('<a:');
        
        const embed = new EmbedBuilder()
            .setColor('#7289DA')
            .setTitle('Emoji Inspector')
            .setThumbnail(`https://cdn.discordapp.com/emojis/${emojiId}.${isAnimated ? 'gif' : 'png'}`)
            .addFields(
                { name: 'Preview', value: emojiStr, inline: true },
                { name: 'Name', value: `\`${emojiName}\``, inline: true },
                { name: 'ID', value: `\`${emojiId}\``, inline: true },
                { name: 'Code String', value: `\`\`\`${emojiStr}\`\`\`` }
            );
            
        await interaction.reply({ embeds: [embed], flags: 64 });
    },
};