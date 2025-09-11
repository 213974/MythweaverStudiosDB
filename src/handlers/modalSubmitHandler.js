// handlers/modalSubmitHandler.js
const { ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/database');
const { sendOrUpdateDashboard } = require('../utils/dashboardManager');
const { sendOrUpdateAdminDashboard } = require('../utils/adminDashboardManager');
const clanManager = require('../utils/clanManager');
const economyManager = require('../utils/economyManager');
const { formatTimestamp } = require('../utils/timestampFormatter');

async function parseUser(guild, userInput) {
    const matches = userInput.match(/^(?:<@!?)?(\d{17,19})>?$/);
    if (matches) return guild.members.fetch(matches[1]).catch(() => null);
    return null;
}

async function handleSetClanChannelModal(interaction) {
    await interaction.deferReply({ flags: 64 });
    const channelId = interaction.fields.getTextInputValue('channel_id_input');
    const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildText) return interaction.editReply({ content: 'Invalid channel ID.' });
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('dashboard_channel_id', channelId);
    db.prepare('DELETE FROM settings WHERE key = ?').run('dashboard_message_id');
    await sendOrUpdateDashboard(interaction.client);
    await interaction.editReply({ content: `Clan dashboard channel has been set to ${channel}.` });
}

async function handleSetAdminChannelModal(interaction) {
    await interaction.deferReply({ flags: 64 });
    const channelId = interaction.fields.getTextInputValue('channel_id_input');
    const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildText) return interaction.editReply({ content: 'Invalid channel ID.' });
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('admin_dashboard_channel_id', channelId);
    db.prepare('DELETE FROM settings WHERE key = ?').run('admin_dashboard_message_id');
    await sendOrUpdateAdminDashboard(interaction.client);
    await interaction.editReply({ content: `Admin dashboard channel has been set to ${channel}.` });
}

async function handleClanDashboardModal(interaction) {
    const customId = interaction.customId;

    if (customId === 'dashboard_invite_modal') {
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
        const targetUserAnyClan = clanManager.findClanContainingUser(targetMember.id);
        if (targetUserAnyClan) {
            return interaction.editReply({ content: `${targetMember.user.username} is already in a clan. They must leave first.` });
        }
        const inviteTimestamp = Math.floor(Date.now() / 1000) + 300;
        const inviteEmbed = new EmbedBuilder().setColor(clanDiscordRole.color || '#0099ff').setTitle(`⚔️ Clan Invitation: ${clanDiscordRole.name} ⚔️`)
            .setDescription(`<@${interaction.user.id}> has invited you to join **${clanDiscordRole.name}** as **${authorityInput}**.`)
            .addFields({ name: 'Expires', value: formatTimestamp(inviteTimestamp, 'R') })
            .setFooter({ text: `Guild: ${interaction.guild.name} | One clan per user.` });
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`clan_accept_${actingUserClan.clanRoleId}_${targetMember.id}_${authorityInput.replace(/\s+/g, '-')}`).setLabel('Accept').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`clan_deny_${actingUserClan.clanRoleId}_${targetMember.id}`).setLabel('Deny').setStyle(ButtonStyle.Danger)
        );
        await interaction.channel.send({ content: `<@${targetMember.id}>`, embeds: [inviteEmbed], components: [row] });
        await interaction.editReply({ content: 'Invitation sent.' });
    } else if (customId === 'dashboard_kick_modal') {
        await interaction.deferReply({ flags: 64 });
        const userInput = interaction.fields.getTextInputValue('user_input');
        const reason = interaction.fields.getTextInputValue('reason_input') || 'No reason provided.';
        const targetMember = await parseUser(interaction.guild, userInput);
        if (!targetMember) return interaction.editReply({ content: 'Could not find that user.' });
        const actingUserClan = clanManager.findClanContainingUser(interaction.user.id);
        const removeResult = clanManager.removeUserFromClan(actingUserClan.clanRoleId, targetMember.id);
        if (removeResult.success) {
            await targetMember.roles.remove(actingUserClan.clanRoleId).catch(() => { });
            await interaction.editReply({ content: `Successfully kicked ${targetMember.user.username} from the clan for: ${reason}` });
        } else {
            await interaction.editReply({ content: `Failed to kick member: ${removeResult.message}` });
        }
    } else if (customId === 'dashboard_motto_modal') {
        await interaction.deferReply({ flags: 64 });
        const motto = interaction.fields.getTextInputValue('motto_input');
        const actingUserClan = clanManager.findClanContainingUser(interaction.user.id);
        clanManager.setClanMotto(actingUserClan.clanRoleId, motto || null);
        await interaction.editReply({ content: 'Your clan motto has been updated.' });
    } else if (customId === 'dashboard_authority_modal') {
        await interaction.deferReply({ flags: 64 });
        const userInput = interaction.fields.getTextInputValue('user_input');
        const authorityInput = interaction.fields.getTextInputValue('authority_input').trim();
        const targetMember = await parseUser(interaction.guild, userInput);
        if (!targetMember) return interaction.editReply({ content: 'Could not find that user.' });
        const actingUserClan = clanManager.findClanContainingUser(interaction.user.id);
        const result = clanManager.manageClanMemberRole(actingUserClan.clanRoleId, targetMember.id, authorityInput);
        if (result.success) {
            await interaction.editReply({ content: `Successfully changed ${targetMember.user.username}'s authority to **${authorityInput}**.` });
        } else {
            await interaction.editReply({ content: `Failed to change authority: ${result.message}` });
        }
    }
}

async function handleAdminDashboardModal(interaction) {
    await interaction.deferReply({ flags: 64 });
    const customId = interaction.customId;

    if (customId === 'admin_dash_economy_modal') {
        const action = interaction.fields.getTextInputValue('action_input').toLowerCase();
        const userInput = interaction.fields.getTextInputValue('user_input');
        const amount = parseInt(interaction.fields.getTextInputValue('amount_input'), 10);
        const destination = interaction.fields.getTextInputValue('dest_input').toLowerCase();
        const targetUser = await parseUser(interaction.guild, userInput);

        if (!['give', 'remove', 'set'].includes(action)) return interaction.editReply({ content: 'Invalid action.' });
        if (!targetUser) return interaction.editReply({ content: 'Invalid user.' });
        if (isNaN(amount) || amount < 0) return interaction.editReply({ content: 'Invalid amount.' });
        if (!['bank', 'balance'].includes(destination)) return interaction.editReply({ content: 'Invalid destination.' });

        if (action === 'give') db.prepare(`UPDATE wallets SET ${destination} = ${destination} + ? WHERE user_id = ? AND currency = ?`).run(amount, targetUser.id, 'Gold');
        else if (action === 'remove') db.prepare(`UPDATE wallets SET ${destination} = ${destination} - ? WHERE user_id = ? AND currency = ?`).run(amount, targetUser.id, 'Gold');
        else if (action === 'set') db.prepare(`UPDATE wallets SET ${destination} = ? WHERE user_id = ? AND currency = ?`).run(amount, targetUser.id, 'Gold');

        await interaction.editReply({ content: `Successfully performed '${action}' on ${targetUser.user.username}'s ${destination} for ${amount} Gold.` });
    } else if (customId === 'admin_dash_shop_modal') {
        const action = interaction.fields.getTextInputValue('action_input').toLowerCase();
        const roleId = interaction.fields.getTextInputValue('role_input');
        const price = parseInt(interaction.fields.getTextInputValue('price_input'), 10);
        const role = await interaction.guild.roles.fetch(roleId).catch(() => null);

        if (!['add', 'remove', 'update'].includes(action)) return interaction.editReply({ content: 'Invalid action.' });
        if (!role) return interaction.editReply({ content: 'Invalid role ID.' });
        if ((action === 'add' || action === 'update') && (isNaN(price) || price < 0)) return interaction.editReply({ content: 'Invalid price for this action.' });

        if (action === 'add') {
            economyManager.addShopItem(role.id, price, role.name, '');
            await interaction.editReply({ content: `Added ${role.name} to the shop.` });
        } else if (action === 'remove') {
            economyManager.removeShopItem(role.id);
            await interaction.editReply({ content: `Removed ${role.name} from the shop.` });
        } else if (action === 'update') {
            economyManager.updateShopItem(role.id, price);
            await interaction.editReply({ content: `Updated ${role.name}'s price in the shop.` });
        }
    }
}

async function handleNavModal(interaction) {
    const customId = interaction.customId;
    if (customId === 'nav_deposit_modal') {
        await interaction.deferReply({ flags: 64 });
        const amount = parseInt(interaction.fields.getTextInputValue('amount_input'), 10);
        if (isNaN(amount) || amount <= 0) return interaction.editReply({ content: 'Please enter a valid positive number.' });
        const result = economyManager.depositToBank(interaction.user.id, amount, 'Gold');
        if (result.success) await interaction.editReply({ content: `Successfully deposited **${amount.toLocaleString()}** 🪙 to your Player Balance.` });
        else await interaction.editReply({ content: `Deposit failed: ${result.message}` });
    } else if (customId === 'nav_withdraw_modal') {
        await interaction.deferReply({ flags: 64 });
        const amount = parseInt(interaction.fields.getTextInputValue('amount_input'), 10);
        if (isNaN(amount) || amount <= 0) return interaction.editReply({ content: 'Please enter a valid positive number.' });
        const result = economyManager.withdrawFromBank(interaction.user.id, amount, 'Gold');
        if (result.success) await interaction.editReply({ content: `Successfully withdrew **${amount.toLocaleString()}** 🪙 from your Player Balance.` });
        else await interaction.editReply({ content: `Withdrawal failed: ${result.message}` });
    }
}

async function handleUpgradeBankConfirm(interaction) {
    const userId = interaction.customId.split('_')[3];
    if (interaction.user.id !== userId) return interaction.reply({ content: 'This confirmation is not for you.', flags: 64 });
    const result = economyManager.upgradeBankTier(userId, 'Gold');
    const embed = new EmbedBuilder();
    if (result.success) {
        embed.setColor('#2ECC71').setTitle('🚀 Bank Upgrade Successful!').setDescription(`You have successfully upgraded your bank to **Tier ${result.newTier}**!`).addFields(
            { name: 'Cost', value: `> ${result.cost.toLocaleString()} 🪙`, inline: true },
            { name: 'New Capacity', value: `> ${result.newCapacity.toLocaleString()} 🪙`, inline: true }
        );
    } else {
        embed.setColor('#E74C3C').setTitle('Upgrade Failed').setDescription(result.message);
    }
    await interaction.update({ embeds: [embed], components: [] });
}

module.exports = {
    handleSetClanChannelModal,
    handleSetAdminChannelModal,
    handleClanDashboardModal,
    handleAdminDashboardModal,
    handleNavModal,
    handleUpgradeBankConfirm,
};