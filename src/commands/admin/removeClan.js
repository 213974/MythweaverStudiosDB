// commands/admin/removeClan.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const clanManager = require('../../utils/clanManager');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin-clan-remove')
        .setDescription('Removes a clan from the system and DMs the owner.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addRoleOption(option =>
            option.setName('clan')
                .setDescription('The clan role to remove.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('The reason for removal (will be DMed to the owner).')
                .setRequired(false)),
    async execute(interaction) {
        if (interaction.user.id !== config.ownerID && !interaction.member.roles.cache.has(config.serverAdminRoleID)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: 64 });
        }

        const clanRole = interaction.options.getRole('clan');
        const reason = interaction.options.getString('reason') || 'No reason provided.';
        const client = interaction.client;

        // Verify it is a clan role first
        const clanData = clanManager.getClanData(clanRole.id);
        if (!clanData) {
            return interaction.reply({ content: `The role **${clanRole.name}** is not a registered clan.`, flags: 64 });
        }

        const result = await clanManager.deleteClan(clanRole.id);

        if (result.success) {
            const ownerId = result.ownerId;
            let dmFailed = false;

            if (ownerId) {
                try {
                    const owner = await client.users.fetch(ownerId);
                    await owner.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor('#ff0000')
                                .setTitle('Clan Disbanded by Administrator')
                                .setDescription(`Your clan, **${clanRole.name}**, has been removed from the system.`)
                                .addFields({ name: 'Reason', value: reason })
                                .setTimestamp()
                        ]
                    });
                } catch (e) {
                    console.error(`[admin-clan-remove] Failed to DM clan owner ${ownerId}:`, e);
                    dmFailed = true;
                }
            }

            const successEmbed = new EmbedBuilder()
                .setColor('#fff000')
                .setTitle('🗑️ Clan Removed 🗑️')
                .setDescription(`The clan associated with the **${clanRole.name}** role has been removed from the system.`)
                .addFields(
                    { name: 'Removed by', value: `<@${interaction.user.id}>` },
                    { name: 'Note', value: `The Discord role itself still exists and must be manually deleted.` }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [successEmbed] });

            if (dmFailed) {
                await interaction.followUp({ content: `Warning: Could not DM the former clan owner. They may have DMs disabled.`, flags: 64 });
            }

        } else {
            await interaction.reply({ content: `Failed to remove clan: ${result.message}`, flags: 64 });
        }
    },
};