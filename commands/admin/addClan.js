// commands/admin/addClan.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const clanManager = require('../../utils/clanManager');
const config = require('../../src/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin-add-clan')
        .setDescription('Assigns a Discord role as a clan, sets owner, and auto-enrolls existing role holders.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addRoleOption(option =>
            option.setName('clanrole')
                .setDescription('The Discord role to designate as the clan role.')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('clanowner')
                .setDescription('The user to set as the owner of this clan.')
                .setRequired(true)),
    async execute(interaction) {
        if (interaction.user.id !== config.ownerID && !interaction.member.roles.cache.has(config.serverAdminRoleID)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: 64 });
        }

        const clanRole = interaction.options.getRole('clanrole');
        const clanOwnerUser = interaction.options.getUser('clanowner');
        const guild = interaction.guild;
        const client = interaction.client; // Get client from interaction

        const ownerExistingClan = clanManager.findClanContainingUser(clanOwnerUser.id);
        if (ownerExistingClan) {
            const existingClanDiscordRole = await guild.roles.fetch(ownerExistingClan.clanRoleId).catch(() => null);
            return interaction.reply({
                content: `${clanOwnerUser.username} is already a member of **${existingClanDiscordRole?.name || 'an existing clan'}**. A user can only be part of one clan.`,
                flags: 64
            });
        }

        const existingClanByRole = clanManager.getClanData(clanRole.id);
        if (existingClanByRole) {
            return interaction.reply({ content: `The role ${clanRole.name} is already registered as a clan.`, flags: 64 });
        }

        // Pass client and guild context to createClan
        const result = await clanManager.createClan(client, guild, clanRole.id, clanOwnerUser.id);

        if (result.success) {
            try {
                const ownerMember = await guild.members.fetch(clanOwnerUser.id);
                if (!ownerMember.roles.cache.has(clanRole.id)) {
                    await ownerMember.roles.add(clanRole);
                }
            } catch (error) {
                console.error(`[addClan] Failed to fetch or assign role to owner ${clanOwnerUser.id}:`, error);
            }

            const successEmbed = new EmbedBuilder()
                .setColor('#fff000')
                .setTitle('👑 Clan Established! 👑')
                .setDescription(`<@${clanOwnerUser.id}> has been designated as the Clan Owner of **${clanRole.name}**!`)
                .addFields(
                    { name: 'Clan Role', value: `<@&${clanRole.id}>` },
                    { name: 'Next Steps for Owner', value: `You can invite new members or manage existing ones using \`/clan invite\`.` },
                    { name: 'Notes', value: `Members already holding the <@&${clanRole.id}> role will be auto-enrolled as clan members if they are not in another clan.` }
                )
                .setFooter({ text: `Command executed by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            if (result.autoEnrolledCount && result.autoEnrolledCount > 0) {
                successEmbed.addFields({ name: 'Auto-Enrolled Members', value: `${result.autoEnrolledCount} existing holder(s) of the ${clanRole.name} role (not already in other clans) have been automatically added as Members.` });
            }

            try {
                await interaction.reply({ embeds: [successEmbed], flags: 0 });
            } catch (replyError) {
                console.error("[addClan] Error sending public success reply:", replyError);
                await interaction.followUp({ content: `Clan created. Public announcement failed.`, flags: 64 });
            }
        } else {
            await interaction.reply({ content: `Failed to set clan role: ${result.message}`, flags: 64 });
        }
    },
};