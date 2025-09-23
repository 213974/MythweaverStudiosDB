// src/handlers/interactions/devInteractionHandler.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ChannelType } = require('discord.js');
const config = require('../../config');
const db = require('../../utils/database');
const { parseRole } = require('../../utils/interactionHelpers');
const { sendOrUpdateDashboard } = require('../../utils/dashboardManager'); // Restored import

module.exports = async (interaction) => {
    if (interaction.user.id !== config.ownerID) {
        return interaction.reply({ content: 'You do not have permission to use this component.', flags: 64 });
    }

    if (interaction.isButton()) {
        const customId = interaction.customId;
        let modal;

        if (customId === 'settings_set_admin_role') {
            modal = new ModalBuilder().setCustomId('settings_modal_admin_role').setTitle('Set Administrator Role');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('role_id_input').setLabel("Admin Role ID or @Mention").setStyle(TextInputStyle.Short).setRequired(true)));
        } else if (customId === 'settings_set_analytics_channel') {
            modal = new ModalBuilder().setCustomId('settings_modal_analytics_channel').setTitle('Set Analytics Channel');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('channel_id_input').setLabel("Analytics Channel ID").setStyle(TextInputStyle.Short).setRequired(true)));
        } else if (customId === 'settings_set_clan_dash') {
            modal = new ModalBuilder().setCustomId('settings_modal_clan_dash').setTitle('Set Clan Dashboard Channel');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('channel_id_input').setLabel("Clan Dashboard Channel ID").setStyle(TextInputStyle.Short).setRequired(true)));
        }
        if (modal) await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit()) {
        await interaction.deferReply({ flags: 64 });
        const customId = interaction.customId;
        const channelInput = interaction.fields.getTextInputValue('channel_id_input');
        const channelId = channelInput?.match(/\d{17,19}/)?.[0];

        if (customId === 'settings_modal_admin_role') {
            const role = await parseRole(interaction.guild, interaction.fields.getTextInputValue('role_id_input'));
            if (!role) return interaction.editReply({ content: 'Invalid Role ID.' });
            db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_role_id', ?)").run(role.id);
            await interaction.editReply({ content: `✅ **Admin Role** set to ${role}.` });
        } else if (customId === 'settings_modal_analytics_channel') {
            const channel = channelId ? await interaction.guild.channels.fetch(channelId).catch(() => null) : null;
            if (!channel || channel.type !== ChannelType.GuildText) return interaction.editReply({ content: 'Invalid Text Channel ID.' });
            db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('analytics_channel_id', ?)").run(channel.id);
            db.prepare("DELETE FROM settings WHERE key = 'analytics_message_id'").run();
            await interaction.editReply({ content: `✅ **Analytics Channel** set to ${channel}.` });
        } else if (customId === 'settings_modal_clan_dash') {
            const channel = channelId ? await interaction.guild.channels.fetch(channelId).catch(() => null) : null;
            if (!channel || channel.type !== ChannelType.GuildText) return interaction.editReply({ content: 'Invalid Text Channel ID.' });
            db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('dashboard_channel_id', ?)").run(channel.id);
            db.prepare("DELETE FROM settings WHERE key = 'dashboard_message_id'").run();
            await sendOrUpdateDashboard(interaction.client); // Immediately post/update it
            await interaction.editReply({ content: `✅ **Clan Dashboard Channel** set to ${channel}.` });
        }
    }
};