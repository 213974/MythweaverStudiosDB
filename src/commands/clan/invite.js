// src/commands/clan/invite.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const clanManager = require('../../managers/clanManager');
const { formatTimestamp } = require('../../helpers/timestampFormatter');

module.exports = {
    async execute(interaction, guildId, userClanData, permissions) {
        // Initial permission and state checks
        if (!permissions.isOwner && !permissions.isVice) {
            const replyOptions = { content: 'Only Clan Owners or Vice Guild Masters can invite members.', flags: 64 };
            return interaction.replied || interaction.deferred ? interaction.editReply(replyOptions) : interaction.reply(replyOptions);
        }
        if (!userClanData) {
            const replyOptions = { content: 'Could not find your clan data to send an invite.', flags: 64 };
            return interaction.replied || interaction.deferred ? interaction.editReply(replyOptions) : interaction.reply(replyOptions);
        }

        const targetUser = interaction.options.getUser('user');
        const newAuthority = interaction.options.getString('authority');

        // Validation checks
        if (targetUser.bot || targetUser.id === interaction.user.id) {
            const replyOptions = { content: "You cannot invite bots or yourself.", flags: 64 };
            return interaction.replied || interaction.deferred ? interaction.editReply(replyOptions) : interaction.reply(replyOptions);
        }
        if (newAuthority === 'Vice Guild Master' && !permissions.isOwner) {
            const replyOptions = { content: 'Only the Clan Owner can invite members directly as Vice Guild Master.', flags: 64 };
            return interaction.replied || interaction.deferred ? interaction.editReply(replyOptions) : interaction.reply(replyOptions);
        }
        const targetUserAnyClan = clanManager.findClanContainingUser(guildId, targetUser.id);
        if (targetUserAnyClan) {
            const replyOptions = { content: `${targetUser.username} is already in a clan in this server.`, flags: 64 };
            return interaction.replied || interaction.deferred ? interaction.editReply(replyOptions) : interaction.reply(replyOptions);
        }
        
        const clanDiscordRole = await interaction.guild.roles.fetch(userClanData.clanRoleId);
        const inviteTimestamp = Math.floor(Date.now() / 1000) + 60; // 60 second expiration

        const inviteEmbed = new EmbedBuilder()
            .setColor(clanDiscordRole.color || '#0099ff')
            .setTitle(`⚔️ Clan Invitation: ${clanDiscordRole.name} ⚔️`)
            .setDescription(`${interaction.user} has invited you to join **${clanDiscordRole.name}** as a **${newAuthority}**.`)
            .addFields({ name: 'Expires', value: formatTimestamp(inviteTimestamp, 'R') });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`clan_accept_${userClanData.clanRoleId}_${targetUser.id}_${newAuthority.replace(/\s+/g, '-')}`).setLabel('Accept').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`clan_deny_${userClanData.clanRoleId}_${targetUser.id}`).setLabel('Deny').setStyle(ButtonStyle.Danger)
        );

        const replyOptions = {
            content: `${targetUser}`,
            embeds: [inviteEmbed],
            components: [row],
            flags: 0 // Make it public
        };

        // --- Use editReply if called from dashboard, otherwise use reply ---
        const reply = await (interaction.replied || interaction.deferred ? interaction.editReply(replyOptions) : interaction.reply(replyOptions));

        const collector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

        collector.on('collect', i => {
            // The logic for handling the button press is now in clanInteractionHandler.
            // This collector is only for the timeout.
            // We stop it on any valid collection to prevent the timeout message.
            if (i.user.id === targetUser.id) {
                collector.stop();
            }
        });

        collector.on('end', (collected, reason) => {
            // If the timer runs out ('time') and no valid button was pressed, edit the message.
            if (reason === 'time' && collected.size === 0) {
                const expiredEmbed = EmbedBuilder.from(inviteEmbed)
                    .setColor('#808080')
                    .addFields({ name: 'Status', value: '⌛ This invitation has expired.' });
                
                const disabledRow = ActionRowBuilder.from(row);
                disabledRow.components.forEach(c => c.setDisabled(true));

                reply.edit({ embeds: [expiredEmbed], components: [disabledRow] }).catch(() => {});
            }
        });
    }
};