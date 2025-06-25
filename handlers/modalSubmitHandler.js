// handlers/modalSubmitHandler.js
const { ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/database');
const { sendOrUpdateDashboard } = require('../utils/dashboardManager');
const clanManager = require('../utils/clanManager');
const { formatTimestamp } = require('../utils/timestampFormatter');

// Helper function to parse user input (ID or mention)
async function parseUser(guild, userInput) {
    const matches = userInput.match(/^(?:<@!?)?(\d{17,19})>?$/);
    if (matches) {
        return guild.members.fetch(matches[1]).catch(() => null);
    }
    return null;
}

// --- Dashboard Channel ---
async function handleDashboardChannelModal(interaction) {
    await interaction.deferReply({ flags: 64 });
    const channelId = interaction.fields.getTextInputValue('channel_id_input');
    const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildText) {
        return interaction.editReply({ content: 'Invalid channel ID. Please provide a valid text channel ID.' });
    }
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
        .run('dashboard_channel_id', channelId);

    db.prepare('DELETE FROM settings WHERE key = ?').run('dashboard_message_id');
    await sendOrUpdateDashboard(interaction.client);
    await interaction.editReply({ content: `Clan dashboard channel has been set to ${channel}.` });
}

// --- Invite Modal ---
async function handleInviteModal(interaction) {
    await interaction.deferReply({ flags: 64 });

    const userInput = interaction.fields.getTextInputValue('user_input');
    const authorityInput = interaction.fields.getTextInputValue('authority_input').trim();
    const validAuthorities = ['member', 'officer', 'vice guild master'];

    if (!validAuthorities.includes(authorityInput.toLowerCase())) {
        return interaction.editReply({ content: 'Invalid authority level. Please use Member, Officer, or Vice Guild Master.' });
    }

    const targetMember = await parseUser(interaction.guild, userInput);
    if (!targetMember) {
        return interaction.editReply({ content: 'Could not find the specified user in this server.' });
    }

    const actingUserClan = clanManager.findClanContainingUser(interaction.user.id);
    if (!actingUserClan) {
        return interaction.editReply({ content: 'Could not find your clan data. Please try again.' });
    }

    const actorIsOwner = actingUserClan.clanOwnerUserID === interaction.user.id;
    if (authorityInput.toLowerCase() === 'vice guild master' && !actorIsOwner) {
        return interaction.editReply({ content: 'Only the Clan Owner can invite a Vice Guild Master.' });
    }

    const clanDiscordRole = await interaction.guild.roles.fetch(actingUserClan.clanRoleId).catch(() => null);
    if (!clanDiscordRole) {
        return interaction.editReply({ content: 'An error occurred: Your clan\'s Discord role could not be found.' });
    }

    // Check if target is already in a clan
    const targetUserAnyClan = clanManager.findClanContainingUser(targetMember.id);
    if (targetUserAnyClan) {
        return interaction.editReply({ content: `${targetMember.user.username} is already in a clan. They must leave first.` });
    }

    // Send the invite to the dashboard channel
    const dashboardChannelId = db.prepare('SELECT value FROM settings WHERE key = ?').get('dashboard_channel_id')?.value;
    const dashboardChannel = await interaction.client.channels.fetch(dashboardChannelId).catch(() => null);
    if (!dashboardChannel) {
        return interaction.editReply({ content: 'Error: The dashboard channel is not set or could not be found.' });
    }

    const inviteTimestamp = Math.floor(Date.now() / 1000) + 300; // 5 minute expiry
    const inviteEmbed = new EmbedBuilder().setColor(clanDiscordRole.color || '#0099ff').setTitle(`⚔️ Clan Invitation: ${clanDiscordRole.name} ⚔️`)
        .setDescription(`<@${interaction.user.id}> has invited you to join **${clanDiscordRole.name}** as **${authorityInput}**.`)
        .addFields({ name: 'Expires', value: formatTimestamp(inviteTimestamp, 'R') })
        .setFooter({ text: `Guild: ${interaction.guild.name} | One clan per user.` });
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`clan_accept_${actingUserClan.clanRoleId}_${targetMember.id}_${authorityInput.replace(/\s+/g, '-')}`).setLabel('Accept').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`clan_deny_${actingUserClan.clanRoleId}_${targetMember.id}`).setLabel('Deny').setStyle(ButtonStyle.Danger)
    );

    await dashboardChannel.send({ content: `<@${targetMember.id}>`, embeds: [inviteEmbed], components: [row] });
    await interaction.editReply({ content: `Invitation sent to ${targetMember.user.username} in the ${dashboardChannel} channel.` });
}

// --- Kick Modal ---
async function handleKickModal(interaction) {
    await interaction.deferReply({ flags: 64 });
    const userInput = interaction.fields.getTextInputValue('user_input');
    const reason = interaction.fields.getTextInputValue('reason_input') || 'No reason provided.';
    const targetMember = await parseUser(interaction.guild, userInput);
    if (!targetMember) return interaction.editReply({ content: 'Could not find the specified user in this server.' });

    const actingUserClan = clanManager.findClanContainingUser(interaction.user.id);
    if (!actingUserClan) return interaction.editReply({ content: 'You are not in a clan.' });

    const targetUserClan = clanManager.findClanContainingUser(targetMember.id);
    if (!targetUserClan || targetUserClan.clanRoleId !== actingUserClan.clanRoleId) {
        return interaction.editReply({ content: `${targetMember.user.username} is not in your clan.` });
    }

    if (targetMember.id === actingUserClan.clanOwnerUserID) {
        return interaction.editReply({ content: 'You cannot kick the Clan Owner.' });
    }

    const actorIsOwner = actingUserClan.clanOwnerUserID === interaction.user.id;
    const actorIsVice = (actingUserClan.viceGuildMasters || []).includes(interaction.user.id);
    const targetUserAuth = db.prepare('SELECT authority FROM clan_members WHERE user_id = ? AND clan_id = ?').get(targetMember.id, actingUserClan.clanRoleId)?.authority;

    if (targetUserAuth === 'Vice Guild Master' && !actorIsOwner) {
        return interaction.editReply({ content: 'Only the Owner can kick a Vice GM.' });
    }
    if (targetUserAuth === 'Officer' && !actorIsOwner && !actorIsVice) {
        return interaction.editReply({ content: 'Only the Owner or a Vice GM can kick an Officer.' });
    }

    const removeResult = clanManager.removeUserFromClan(actingUserClan.clanRoleId, targetMember.id);
    if (removeResult.success) {
        await targetMember.roles.remove(actingUserClan.clanRoleId).catch(e => console.error("Failed to remove role on kick:", e));
        await interaction.editReply({ content: `Successfully kicked ${targetMember.user.username} from the clan for: ${reason}` });
    } else {
        await interaction.editReply({ content: `Failed to kick member: ${removeResult.message}` });
    }
}

// --- Motto Modal ---
async function handleMottoModal(interaction) {
    await interaction.deferReply({ flags: 64 });
    const motto = interaction.fields.getTextInputValue('motto_input');
    const actingUserClan = clanManager.findClanContainingUser(interaction.user.id);
    const actorIsOwner = actingUserClan.clanOwnerUserID === interaction.user.id;

    if (!actorIsOwner) {
        return interaction.editReply({ content: 'Only the Clan Owner can set the motto.' });
    }

    clanManager.setClanMotto(actingUserClan.clanRoleId, motto || null);
    await interaction.editReply({ content: 'Your clan motto has been successfully updated.' });
}

// --- Authority Modal ---
async function handleAuthorityModal(interaction) {
    await interaction.deferReply({ flags: 64 });
    const userInput = interaction.fields.getTextInputValue('user_input');
    const authorityInput = interaction.fields.getTextInputValue('authority_input').trim();
    const validAuthorities = ['member', 'officer', 'vice guild master'];

    if (!validAuthorities.includes(authorityInput.toLowerCase())) {
        return interaction.editReply({ content: 'Invalid authority level. Please use Member, Officer, or Vice Guild Master.' });
    }

    const targetMember = await parseUser(interaction.guild, userInput);
    if (!targetMember) return interaction.editReply({ content: 'Could not find the specified user in this server.' });

    const actingUserClan = clanManager.findClanContainingUser(interaction.user.id);
    if (!actingUserClan) return interaction.editReply({ content: 'You are not in a clan.' });

    const targetUserClan = clanManager.findClanContainingUser(targetMember.id);
    if (!targetUserClan || targetUserClan.clanRoleId !== actingUserClan.clanRoleId) {
        return interaction.editReply({ content: `${targetMember.user.username} is not in your clan.` });
    }

    if (targetMember.id === actingUserClan.clanOwnerUserID) {
        return interaction.editReply({ content: "The Clan Owner's authority cannot be changed." });
    }

    const actorIsOwner = actingUserClan.clanOwnerUserID === interaction.user.id;
    const userAuth = db.prepare('SELECT authority FROM clan_members WHERE user_id = ? AND clan_id = ?').get(targetMember.id, actingUserClan.clanRoleId)?.authority;

    if (userAuth.toLowerCase() === authorityInput.toLowerCase()) {
        return interaction.editReply({ content: `${targetMember.user.username} already has this authority level.` });
    }

    if (authorityInput.toLowerCase() === 'vice guild master' && !actorIsOwner) {
        return interaction.editReply({ content: 'Only the Clan Owner can promote to Vice Guild Master.' });
    }
    if ((userAuth === 'Officer' || userAuth === 'Vice Guild Master') && !actorIsOwner) {
        return interaction.editReply({ content: 'Only the Clan Owner can demote Officers or Vice Guild Masters.' });
    }

    const result = clanManager.manageClanMemberRole(actingUserClan.clanRoleId, targetMember.id, authorityInput);
    if (result.success) {
        await interaction.editReply({ content: `Successfully changed ${targetMember.user.username}'s authority to **${authorityInput}**.` });
    } else {
        await interaction.editReply({ content: `Failed to change authority: ${result.message}` });
    }
}

module.exports = {
    handleDashboardChannelModal,
    handleInviteModal,
    handleKickModal,
    handleMottoModal,
    handleAuthorityModal,
};