// src/commands/clan/kick.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const clanManager = require('../../managers/clanManager');
const db = require('../../utils/database');

module.exports = {
    async execute(interaction, guildId, userClanData, permissions) {
        const replyOrEdit = async (options) => {
            if (interaction.replied || interaction.deferred) {
                return interaction.editReply(options);
            }
            return interaction.reply(options);
        };

        if (!permissions.isOwner && !permissions.isVice && !permissions.isOfficer) {
            return replyOrEdit({ content: 'You do not have the required authority to kick members.', flags: 64 });
        }

        const targetUserToKick = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided.';

        if (targetUserToKick.id === interaction.user.id) {
            return replyOrEdit({ content: "You cannot kick yourself.", flags: 64 });
        }

        const targetUserClan = clanManager.findClanContainingUser(guildId, targetUserToKick.id);
        if (!targetUserClan || targetUserClan.clanRoleId !== userClanData.clanRoleId) {
            // --- FIX: Use username property for plain text ---
            return replyOrEdit({ content: `${targetUserToKick.username} is not in your clan.`, flags: 64 });
        }
        
        const targetUserAuth = db.prepare('SELECT authority FROM clan_members WHERE guild_id = ? AND user_id = ?').get(guildId, targetUserToKick.id)?.authority;
        if (!targetUserAuth) {
            return replyOrEdit({ content: 'Could not verify the target member\'s authority.', flags: 64 });
        }

        if (targetUserAuth === 'Owner') return replyOrEdit({ content: "The Owner cannot be kicked.", flags: 64 });
        if (targetUserAuth === 'Vice Guild Master' && !permissions.isOwner) return replyOrEdit({ content: 'Only the Owner can kick a Vice Guild Master.', flags: 64 });
        if (targetUserAuth === 'Officer' && !permissions.isOwner && !permissions.isVice) return replyOrEdit({ content: 'Only the Owner or a Vice Guild Master can kick an Officer.', flags: 64 });
        
        const clanDiscordRole = await interaction.guild.roles.fetch(userClanData.clanRoleId);
        const confirmationEmbed = new EmbedBuilder()
            .setColor('#F1C40F')
            .setTitle('⚠️ Kick Confirmation')
            // --- FIX: Pass the user object directly to setDesciption, which correctly formats it as a mention ---
            .setDescription(`Are you sure you want to kick ${targetUserToKick} from **${clanDiscordRole.name}**?`)
            .addFields({ name: 'Reason', value: reason });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`kick_confirm_${targetUserToKick.id}`).setLabel('Confirm Kick').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`kick_cancel_${targetUserToKick.id}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
        );

        const reply = await replyOrEdit({ embeds: [confirmationEmbed], components: [row], flags: 64 });

        const collector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'This is not for you!', flags: 64 });
            }

            await i.deferUpdate();
            const disabledRow = ActionRowBuilder.from(row).setComponents(row.components.map(c => c.setDisabled(true)));

            if (i.customId.startsWith('kick_confirm')) {
                const removeResult = clanManager.removeUserFromClan(guildId, userClanData.clanRoleId, targetUserToKick.id);
                if (removeResult.success) {
                    const targetMember = await interaction.guild.members.fetch(targetUserToKick.id).catch(() => null);
                    if (targetMember) await targetMember.roles.remove(clanDiscordRole).catch(() => {});

                    const successEmbed = new EmbedBuilder()
                        .setColor('#E74C3C')
                        .setTitle('🛡️ Clan Member Kicked 🛡️')
                        // --- FIX: Pass the user object directly to setDesciption ---
                        .setDescription(`${targetUserToKick} has been kicked from **${clanDiscordRole.name}**.`)
                        .addFields({ name: 'Kicked By', value: `${interaction.user}` }, { name: 'Reason', value: reason });
                    await i.editReply({ embeds: [successEmbed], components: [] });
                } else {
                    await i.editReply({ content: `Failed to kick member: ${removeResult.message}`, components: [] });
                }
            } else { // Cancel button
                const cancelledEmbed = new EmbedBuilder().setColor('#808080').setDescription('Kick action cancelled.');
                await i.editReply({ embeds: [cancelledEmbed], components: [disabledRow] });
            }
            collector.stop();
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                const timeoutEmbed = new EmbedBuilder().setColor('#808080').setDescription('Kick confirmation timed out.');
                const disabledRow = ActionRowBuilder.from(row).setComponents(row.components.map(c => c.setDisabled(true)));
                reply.edit({ embeds: [timeoutEmbed], components: [disabledRow] }).catch(() => {});
            }
        });
    }
};