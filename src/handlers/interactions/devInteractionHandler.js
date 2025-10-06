// src/handlers/interactions/devInteractionHandler.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ChannelType } = require('discord.js');
const config = require('../../config');
const db = require('../../utils/database');
const { parseRole } = require('../../utils/interactionHelpers');
const { sendOrUpdateDashboard } = require('../../utils/dashboardManager');
const { sendOrUpdateLeaderboard } = require('../../utils/leaderboardManager');
// --- THIS IS THE FIX ---
const { updateAnalyticsDashboard } = require('../../utils/scheduler');

module.exports = async (interaction) => {
    // --- THIS IS THE FIX ---
    // The check now correctly verifies if the user's ID is in the ownerIDs array.
    if (!config.ownerIDs.includes(interaction.user.id)) {
        return interaction.reply({ content: 'You do not have permission to use this component.', flags: 64 });
    }

    const guildId = interaction.guild.id;

    if (interaction.isStringSelectMenu()) {
        const selection = interaction.values[0];
        let modal;
        const channelInput = new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('channel_id_input').setLabel("Channel ID or #Mention").setStyle(TextInputStyle.Short).setRequired(true));

        if (selection === 'settings_set_admin_role') {
            modal = new ModalBuilder().setCustomId('settings_modal_admin_role').setTitle('Set Administrator Role');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('role_id_input').setLabel("Admin Role ID or @Mention").setStyle(TextInputStyle.Short).setRequired(true)));
        } else if (selection === 'settings_set_raffle_role') {
            modal = new ModalBuilder().setCustomId('settings_modal_raffle_role').setTitle('Set Raffle Creator Role');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('role_id_input').setLabel("Raffle Creator Role ID or @Mention").setStyle(TextInputStyle.Short).setRequired(true)));
        } else if (selection === 'settings_set_analytics_channel') {
            modal = new ModalBuilder().setCustomId('settings_modal_analytics_channel').setTitle('Set Analytics Channel');
            modal.addComponents(channelInput);
        } else if (selection === 'settings_set_clan_dash') {
            modal = new ModalBuilder().setCustomId('settings_modal_clan_dash').setTitle('Set Clan Dashboard Channel');
            modal.addComponents(channelInput);
        } else if (selection === 'settings_set_leaderboard_channel') {
            modal = new ModalBuilder().setCustomId('settings_modal_leaderboard_channel').setTitle('Set Solyx™ Leaderboard Channel');
            modal.addComponents(channelInput);
        }
        if (modal) await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit()) {
        await interaction.deferReply({ flags: 64 });
        const customId = interaction.customId;

        if (customId === 'settings_modal_admin_role') {
            const role = await parseRole(interaction.guild, interaction.fields.getTextInputValue('role_id_input'));
            if (!role) return interaction.editReply({ content: 'Invalid Role ID.' });
            db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'admin_role_id', ?)").run(guildId, role.id);
            await interaction.editReply({ content: `✅ **Admin Role** set to ${role} for this server.` });
        } else if (customId === 'settings_modal_raffle_role') {
            const role = await parseRole(interaction.guild, interaction.fields.getTextInputValue('role_id_input'));
            if (!role) return interaction.editReply({ content: 'Invalid Role ID.' });
            db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'raffle_creator_role_id', ?)").run(guildId, role.id);
            await interaction.editReply({ content: `✅ **Raffle Creator Role** set to ${role} for this server.` });
        } else if (customId === 'settings_modal_analytics_channel') {
            const channelId = interaction.fields.getTextInputValue('channel_id_input').match(/\d{17,19}/)?.[0];
            const channel = channelId ? await interaction.guild.channels.fetch(channelId).catch(() => null) : null;
            if (!channel || channel.type !== ChannelType.GuildText) return interaction.editReply({ content: 'Invalid Text Channel ID.' });
            db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'analytics_channel_id', ?)").run(guildId, channel.id);
            db.prepare("DELETE FROM settings WHERE guild_id = ? AND key = 'analytics_message_id'").run(guildId);
            // --- THIS IS THE FIX ---
            await updateAnalyticsDashboard(interaction.client, guildId);
            await interaction.editReply({ content: `✅ **Analytics Channel** set to ${channel} for this server. The dashboard has been posted.` });
        } else if (customId === 'settings_modal_clan_dash') {
            const channelId = interaction.fields.getTextInputValue('channel_id_input').match(/\d{17,19}/)?.[0];
            const channel = channelId ? await interaction.guild.channels.fetch(channelId).catch(() => null) : null;
            if (!channel || channel.type !== ChannelType.GuildText) return interaction.editReply({ content: 'Invalid Text Channel ID.' });
            db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'dashboard_channel_id', ?)").run(guildId, channel.id);
            db.prepare("DELETE FROM settings WHERE guild_id = ? AND key = 'dashboard_message_id'").run(guildId);
            await sendOrUpdateDashboard(interaction.client, guildId);
            await interaction.editReply({ content: `✅ **Clan Dashboard Channel** set to ${channel} for this server.` });
        } else if (customId === 'settings_modal_leaderboard_channel') {
            const channelId = interaction.fields.getTextInputValue('channel_id_input').match(/\d{17,19}/)?.[0];
            const channel = channelId ? await interaction.guild.channels.fetch(channelId).catch(() => null) : null;
            if (!channel || channel.type !== ChannelType.GuildText) return interaction.editReply({ content: 'Invalid Text Channel ID.' });
            db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'leaderboard_channel_id', ?)").run(guildId, channel.id);
            db.prepare("DELETE FROM settings WHERE guild_id = ? AND key = 'leaderboard_message_id'").run(guildId);
            await sendOrUpdateLeaderboard(interaction.client, guildId);
            await interaction.editReply({ content: `✅ **Solyx™ Leaderboard Channel** set to ${channel} for this server.` });
        }
    }
};