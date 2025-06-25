// commands/clan/clan.js
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const clanManager = require('../../utils/clanManager');
const { formatTimestamp } = require('../../utils/timestampFormatter');

// Helper function to validate hex color
function isValidHexColor(hex) {
    if (!hex || typeof hex !== 'string') return false;
    return /^#[0-9A-F]{6}$/i.test(hex);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clan')
        .setDescription('Manages clan functionalities.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('invite')
                .setDescription('Invites a user to your clan.')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to invite.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('authority')
                        .setDescription('The authority level to invite the user as.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Member', value: 'Member' },
                            { name: 'Officer', value: 'Officer' },
                            { name: 'Vice Guild Master', value: 'Vice Guild Master' }
                        ))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('authority')
                .setDescription('Promotes or demotes a member already in your clan.')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user whose authority to manage.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('authority')
                        .setDescription('The new authority level to assign.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Member', value: 'Member' },
                            { name: 'Officer', value: 'Officer' },
                            { name: 'Vice Guild Master', value: 'Vice Guild Master' }
                        ))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('kick')
                .setDescription('Kicks a member from your clan.')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to kick from the clan.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('The reason for kicking the member (optional).')
                        .setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('motto')
                .setDescription("Sets or updates your clan's motto.")
                .addStringOption(option =>
                    option.setName('motto')
                        .setDescription('The motto for your clan. Leave blank to remove.')
                        .setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('leave')
                .setDescription('Leave your current clan.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('Views details about a clan.')
                .addRoleOption(option =>
                    option.setName('clanrole')
                        .setDescription('The role of the clan to view. Views your own clan if omitted.')
                        .setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('color')
                .setDescription('Changes the color of your clan\'s Discord role.')
                .addStringOption(option =>
                    option.setName('hexcolor')
                        .setDescription('The new hex color code for the clan role (e.g., #RRGGBB).')
                        .setRequired(true))
        ),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({ content: 'This command can only be used in a server.', flags: 64 });
        }

        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;
        const client = interaction.client;
        const actingUser = interaction.user;

        // --- VIEW SUBCOMMAND (Can be used by anyone) ---
        if (subcommand === 'view') {
            const specifiedRole = interaction.options.getRole('clanrole');
            let clanToViewData;
            let clanToViewRole;

            if (specifiedRole) {
                clanToViewData = clanManager.getClanData(specifiedRole.id);
                if (!clanToViewData) {
                    return interaction.reply({ content: `**${specifiedRole.name}** is not a registered clan.`, flags: 64 });
                }
                clanToViewRole = specifiedRole;
            } else {
                const userClan = clanManager.findClanContainingUser(actingUser.id);
                if (!userClan) {
                    return interaction.reply({ content: "You are not in a clan. Specify a clan role to view its details.", flags: 64 });
                }
                clanToViewData = userClan;
                clanToViewRole = await guild.roles.fetch(userClan.clanRoleId).catch(() => null);
                if (!clanToViewRole) {
                    return interaction.reply({ content: "Could not find your clan's Discord role. Contact an admin.", flags: 64 });
                }
            }

            await interaction.deferReply();

            const { clanOwnerUserID, motto, viceGuildMasters = [], officers = [], members = [] } = clanToViewData;

            const ownerMention = `<@${clanOwnerUserID}>`;
            const viceGMMentions = viceGuildMasters.length > 0 ? viceGuildMasters.map(id => `<@${id}>`).join(', ') : 'None';
            const officerMentions = officers.length > 0 ? officers.map(id => `<@${id}>`).join(', ') : 'None';

            let memberMentions = 'None';
            if (members.length > 0) {
                const displayLimit = 40;
                memberMentions = members.slice(0, displayLimit).map(id => `<@${id}>`).join(', ');
                if (members.length > displayLimit) {
                    memberMentions += `... and ${members.length - displayLimit} more.`;
                }
            }

            const embed = new EmbedBuilder()
                .setColor(clanToViewRole.color || '#FFFFFF')
                .setTitle(`${clanToViewRole.name}`)
                .addFields(
                    { name: '👑 Owner', value: ownerMention },
                    { name: `🛡️ Vice Guild Masters (${viceGuildMasters.length}/${clanManager.MAX_VICE_GUILD_MASTERS})`, value: viceGMMentions },
                    { name: `⚔️ Officers (${officers.length}/${clanManager.MAX_OFFICERS})`, value: officerMentions },
                    { name: `👥 Members (${members.length}/${clanManager.MAX_MEMBERS})`, value: memberMentions }
                )
                .setTimestamp()
                .setFooter({ text: `Clan Role ID: ${clanToViewRole.id}` });

            if (motto) {
                embed.setDescription(`*“${motto}”*`);
            }

            return interaction.editReply({ embeds: [embed] });
        }


        // --- LEAVE SUBCOMMAND (Can be used by anyone in a clan) ---
        if (subcommand === 'leave') {
            const userClan = clanManager.findClanContainingUser(actingUser.id);

            if (!userClan) {
                return interaction.reply({ content: "You are not in any clan.", flags: 64 });
            }
            if (userClan.clanOwnerUserID === actingUser.id) {
                return interaction.reply({ content: "Clan Owners cannot leave their clan. You must transfer ownership or have the clan disbanded by an admin.", flags: 64 });
            }
            const clanRole = await guild.roles.fetch(userClan.clanRoleId).catch(() => null);
            if (!clanRole) {
                return interaction.reply({ content: "Error: Your clan's Discord role could not be found. Please contact an administrator.", flags: 64 });
            }
            const leaveResult = clanManager.removeUserFromClan(userClan.clanRoleId, actingUser.id);

            if (leaveResult.success) {
                // Also remove the role from the user
                const member = await guild.members.fetch(actingUser.id).catch(() => null);
                if (member && clanRole) {
                    await member.roles.remove(clanRole).catch(e => console.error(e));
                }
                return interaction.reply({ content: `You have successfully left **${clanRole.name}**.`, flags: 0 });
            } else {
                return interaction.reply({ content: `Failed to leave clan: ${leaveResult.message}`, flags: 64 });
            }
        }

        // --- All other subcommands require authority within a clan ---
        let actingUserClan = clanManager.findClanByOwner(actingUser.id);
        let actorIsOwner = !!actingUserClan;
        let actorIsVice = false;
        let actorIsOfficer = false;

        if (!actorIsOwner) {
            const clanAffiliation = clanManager.findClanContainingUser(actingUser.id);
            if (clanAffiliation) {
                actingUserClan = clanAffiliation;
                if (clanAffiliation.viceGuildMasters && clanAffiliation.viceGuildMasters.includes(actingUser.id)) {
                    actorIsVice = true;
                }
                if (clanAffiliation.officers && clanAffiliation.officers.includes(actingUser.id)) {
                    actorIsOfficer = true;
                }
            }
        }

        if (!actingUserClan) {
            return interaction.reply({ content: 'You are not in a clan recognized by the system, or not authorized for this action.', flags: 64 });
        }

        const clanDiscordRole = await guild.roles.fetch(actingUserClan.clanRoleId).catch(() => null);
        if (!clanDiscordRole) {
            return interaction.reply({ content: 'Error: Your clan\'s Discord role is missing. Contact an admin.', flags: 64 });
        }

        // --- INVITE SUBCOMMAND ---
        if (subcommand === 'invite') {
            if (!actorIsOwner && !actorIsVice) {
                return interaction.reply({ content: 'Only Clan Owners or Vice Guild Masters can invite members.', flags: 64 });
            }
            const targetUser = interaction.options.getUser('user');
            const newAuthority = interaction.options.getString('authority');

            if (targetUser.bot) return interaction.reply({ content: "Bots cannot be invited to clans.", flags: 64 });
            if (targetUser.id === actingUser.id) return interaction.reply({ content: "You cannot invite yourself.", flags: 64 });

            if (newAuthority.toLowerCase() === 'vice guild master' && !actorIsOwner) return interaction.reply({ content: 'Only Owners can invite directly as Vice GM.', flags: 64 });

            const targetUserAnyClan = clanManager.findClanContainingUser(targetUser.id);
            if (targetUserAnyClan) {
                const otherClanRole = await guild.roles.fetch(targetUserAnyClan.clanRoleId).catch(() => null);
                return interaction.reply({ content: `${targetUser.username} is already in another clan (${otherClanRole?.name || 'Unknown'}). They must leave first.`, flags: 64 });
            }

            const inviteTimestamp = Math.floor(Date.now() / 1000) + 300; // 5 minute expiry
            const inviteEmbed = new EmbedBuilder().setColor(clanDiscordRole.color || '#0099ff').setTitle(`⚔️ Clan Invitation: ${clanDiscordRole.name} ⚔️`)
                .setDescription(`<@${actingUser.id}> has invited you to join **${clanDiscordRole.name}** as **${newAuthority}**.`)
                .addFields({ name: 'Expires', value: formatTimestamp(inviteTimestamp, 'R') })
                .setFooter({ text: `Guild: ${guild.name} | One clan per user.` });
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`clan_accept_${actingUserClan.clanRoleId}_${targetUser.id}_${newAuthority.replace(/\s+/g, '-')}`).setLabel('Accept').setStyle(ButtonStyle.Success).setEmoji('✅'),
                new ButtonBuilder().setCustomId(`clan_deny_${actingUserClan.clanRoleId}_${targetUser.id}`).setLabel('Deny').setStyle(ButtonStyle.Danger).setEmoji('❌')
            );

            await interaction.reply({
                content: `<@${targetUser.id}>`,
                embeds: [inviteEmbed],
                components: [row]
            });
        }
        // --- AUTHORITY SUBCOMMAND ---
        else if (subcommand === 'authority') {
            if (!actorIsOwner && !actorIsVice) {
                return interaction.reply({ content: 'Only Clan Owners or Vice Guild Masters can manage authority.', flags: 64 });
            }
            const targetUser = interaction.options.getUser('user');
            const newAuthority = interaction.options.getString('authority');
            if (targetUser.id === actingUser.id) return interaction.reply({ content: "You cannot manage your own authority.", flags: 64 });

            const targetUserAffiliation = clanManager.findClanContainingUser(targetUser.id);

            if (!targetUserAffiliation || targetUserAffiliation.clanRoleId !== actingUserClan.clanRoleId) {
                return interaction.reply({ content: `<@${targetUser.id}> is not a member of your clan.`, flags: 64 });
            }

            if (targetUserAffiliation.clanOwnerUserID === targetUser.id) return interaction.reply({ content: "The Clan Owner's authority cannot be changed with this command.", flags: 64 });

            // Getting specific authority from the DB for comparison
            const db = require('../../utils/database');
            const userAuth = db.prepare('SELECT authority FROM clan_members WHERE user_id = ? AND clan_id = ?').get(targetUser.id, actingUserClan.clanRoleId);

            if (userAuth.authority.toLowerCase() === newAuthority.toLowerCase()) return interaction.reply({ content: `${targetUser.username} already has the **${newAuthority}** authority level.`, flags: 64 });
            if (newAuthority.toLowerCase() === 'vice guild master' && !actorIsOwner) return interaction.reply({ content: 'Only the Clan Owner can promote members to Vice Guild Master.', flags: 64 });
            if ((userAuth.authority === 'Officer' || userAuth.authority === 'Vice Guild Master') && !actorIsOwner) {
                return interaction.reply({ content: 'Only the Clan Owner can demote Officers or Vice Guild Masters.', flags: 64 });
            }

            const manageResult = clanManager.manageClanMemberRole(actingUserClan.clanRoleId, targetUser.id, newAuthority);
            if (manageResult.success) {
                const embed = new EmbedBuilder().setColor(clanDiscordRole.color || '#0099ff').setTitle('✨ Clan Authority Updated ✨')
                    .setDescription(`<@${targetUser.id}>'s authority in **${clanDiscordRole.name}** has been updated to **${newAuthority}** by <@${actingUser.id}>.`).setTimestamp();
                return interaction.reply({ embeds: [embed] });
            } else {
                return interaction.reply({ content: `Failed to update authority: ${manageResult.message}`, flags: 64 });
            }
        }
        // --- KICK SUBCOMMAND ---
        else if (subcommand === 'kick') {
            if (!actorIsOwner && !actorIsVice && !actorIsOfficer) {
                return interaction.reply({ content: 'Only Clan Owners, Vice Guild Masters, or Officers can kick members.', flags: 64 });
            }
            const targetUserToKick = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided.';
            if (targetUserToKick.id === actingUser.id) return interaction.reply({ content: "You cannot kick yourself.", flags: 64 });

            const targetUserClan = clanManager.findClanContainingUser(targetUserToKick.id);
            if (!targetUserClan || targetUserClan.clanRoleId !== actingUserClan.clanRoleId) {
                return interaction.reply({ content: `${targetUserToKick.username} is not in your clan.`, flags: 64 });
            }

            if (targetUserClan.clanOwnerUserID === targetUserToKick.id) return interaction.reply({ content: "The Owner cannot be kicked.", flags: 64 });

            const db = require('../../utils/database');
            const targetUserAuth = db.prepare('SELECT authority FROM clan_members WHERE user_id = ? AND clan_id = ?').get(targetUserToKick.id, actingUserClan.clanRoleId).authority;

            if (targetUserAuth === 'Vice Guild Master' && !actorIsOwner) return interaction.reply({ content: 'Only the Owner can kick a Vice GM.', flags: 64 });
            if (targetUserAuth === 'Officer' && !actorIsOwner && !actorIsVice) return interaction.reply({ content: 'Only the Owner or a Vice GM can kick an Officer.', flags: 64 });

            const removeResult = clanManager.removeUserFromClan(actingUserClan.clanRoleId, targetUserToKick.id);
            if (removeResult.success) {
                const targetMember = await guild.members.fetch(targetUserToKick.id).catch(() => null);
                if (targetMember && clanDiscordRole) {
                    await targetMember.roles.remove(clanDiscordRole).catch(e => console.error(e));
                }

                const removalEmbed = new EmbedBuilder().setColor('#ff0000').setTitle('🛡️ Clan Member Kicked 🛡️')
                    .setDescription(`<@${targetUserToKick.id}> has been kicked from **${clanDiscordRole.name}**.`)
                    .addFields({ name: 'Kicked By', value: `<@${actingUser.id}>` }, { name: 'Reason', value: reason }).setTimestamp();
                await interaction.reply({ embeds: [removalEmbed], flags: 0 });
                try {
                    await targetUserToKick.send({
                        embeds: [new EmbedBuilder().setColor('#ff0000').setTitle(`Kicked from Clan: ${clanDiscordRole.name}`)
                            .setDescription(`You were kicked by <@${actingUser.id}>.`).addFields({ name: 'Reason', value: reason })
                            .setFooter({ text: `Guild: ${guild.name}` }).setTimestamp()]
                    });
                } catch (e) { console.log(`[Clan Kick] Could not DM user ${targetUserToKick.id}.`); }
            } else {
                return interaction.reply({ content: `Failed: ${removeResult.message}`, flags: 64 });
            }
        }
        // --- MOTTO SUBCOMMAND ---
        else if (subcommand === 'motto') {
            if (!actorIsOwner) {
                return interaction.reply({ content: 'Only the Clan Owner can manage the clan motto.', flags: 64 });
            }
            const motto = interaction.options.getString('motto') || null;
            const result = clanManager.setClanMotto(actingUserClan.clanRoleId, motto);
            if (result.success) {
                if (motto) {
                    await interaction.reply({ content: `Your clan motto has been updated to: *“${motto}”*`, flags: 64 });
                } else {
                    await interaction.reply({ content: `Your clan motto has been removed.`, flags: 64 });
                }
            } else {
                await interaction.reply({ content: `Failed to set motto: ${result.message}`, flags: 64 });
            }
        }
        // --- COLOR SUBCOMMAND ---
        else if (subcommand === 'color') {
            if (!actorIsOwner) {
                return interaction.reply({ content: 'Only the Clan Owner can change the clan role color.', flags: 64 });
            }
            const hexColorInput = interaction.options.getString('hexcolor');
            if (!isValidHexColor(hexColorInput)) {
                return interaction.reply({ content: `Invalid hex color: \`${hexColorInput}\`. Use #RRGGBB format.`, flags: 64 });
            }
            try {
                await clanDiscordRole.setColor(hexColorInput);
                const colorEmbed = new EmbedBuilder().setColor(hexColorInput)
                    .setTitle('🎨 Clan Role Color Updated! 🎨').setDescription(`Color for **${clanDiscordRole.name}** changed to **${hexColorInput}**.`)
                    .addFields({ name: "Role", value: `<@&${clanDiscordRole.id}>` })
                    .setFooter({ text: `Changed by ${actingUser.tag}` }).setTimestamp();
                await interaction.reply({ embeds: [colorEmbed], flags: 0 });
            } catch (error) {
                console.error(`[Clan Color] Failed for role ${clanDiscordRole.id}:`, error);
                if (error.code === 50013) return interaction.reply({ content: `I lack permission to manage the **${clanDiscordRole.name}** role. Please check my role hierarchy.`, flags: 64 });
                return interaction.reply({ content: `An error occurred while changing the role color.`, flags: 64 });
            }
        }
    },
};