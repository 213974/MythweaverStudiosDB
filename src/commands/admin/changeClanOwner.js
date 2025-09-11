// commands/admin/changeClanOwner.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const clanManager = require('../../utils/clanManager');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin-change-clan-owner')
        .setDescription('Changes the owner of a registered clan.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addRoleOption(option =>
            option.setName('clanrole')
                .setDescription('The role of the clan whose owner is being changed.')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('newowner')
                .setDescription('The user to become the new owner of the clan.')
                .setRequired(true)),
    async execute(interaction) {
        if (interaction.user.id !== config.ownerID && !interaction.member.roles.cache.has(config.serverAdminRoleID)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: 64 });
        }

        const clanRole = interaction.options.getRole('clanrole');
        const newOwnerUser = interaction.options.getUser('newowner');
        const guild = interaction.guild;
        const client = interaction.client;

        const clanData = clanManager.getClanData(clanRole.id);
        if (!clanData) {
            return interaction.reply({ content: `The role **${clanRole.name}** is not a registered clan.`, flags: 64 });
        }

        const oldOwnerId = clanData.clanOwnerUserID;
        if (oldOwnerId === newOwnerUser.id) {
            return interaction.reply({ content: `<@${newOwnerUser.id}> is already the owner of this clan.`, flags: 64 });
        }

        const result = await clanManager.setClanOwner(client, guild, clanRole.id, newOwnerUser.id);

        if (result.success) {
            try {
                const newOwnerMember = await guild.members.fetch(newOwnerUser.id).catch(() => null);
                if (newOwnerMember && !newOwnerMember.roles.cache.has(clanRole.id)) {
                    await newOwnerMember.roles.add(clanRole.id);
                }

                const oldOwnerMember = await guild.members.fetch(oldOwnerId).catch(() => null);
                // Decide if old owner should become a regular member. Here we add them as a 'Member'.
                if (oldOwnerMember) {
                    await clanManager.manageClanMemberRole(client, guild, clanRole.id, oldOwnerId, 'Member', client.user.id);
                }

            } catch (error) {
                console.error(`[changeClanOwner] Error managing roles during ownership transfer:`, error);
            }

            const successEmbed = new EmbedBuilder()
                .setColor('#ffd700')
                .setTitle('👑 Clan Ownership Transferred! 👑')
                .setDescription(`Ownership of **${clanRole.name}** has been transferred to <@${newOwnerUser.id}>.`)
                .addFields(
                    { name: 'Old Owner', value: `<@${oldOwnerId}>`, inline: true },
                    { name: 'New Owner', value: `<@${newOwnerUser.id}>`, inline: true }
                )
                .setFooter({ text: `Command executed by ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.reply({ embeds: [successEmbed] });

        } else {
            await interaction.reply({ content: `Failed to change clan owner: ${result.message}`, flags: 64 });
        }
    },
};