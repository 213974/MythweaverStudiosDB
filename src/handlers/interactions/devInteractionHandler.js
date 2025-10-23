// src/handlers/interactions/devInteractionHandler.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ChannelType } = require('discord.js');
const config = require('../../config');
const db = require('../../utils/database');
const { parseRole } = require('../../utils/interactionHelpers');
const { sendOrUpdateDashboard } = require('../../utils/dashboardManager');
const { sendOrUpdateLeaderboard } = require('../../utils/leaderboardManager');
const { updateAnalyticsDashboard } = require('../../utils/scheduler');
const { createHelpDashboard } = require('../../commands/help');
const { sendOrUpdateCommandList } = require('../../utils/publicCommandListManager');
const { createPublicCommandListEmbed } = require('../../components/publicCommandList');
const { createQuickActionsDashboard } = require('../../components/quickActions');

module.exports = async (interaction) => {
    if (!config.ownerIDs.includes(interaction.user.id)) {
        return interaction.reply({ content: 'You do not have permission to use this component.', flags: 64 });
    }

    const guildId = interaction.guild.id;

    if (interaction.isStringSelectMenu()) {
        const selection = interaction.values[0];
        let modal;
        const channelInput = new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('channel_id_input').setLabel("Channel ID or #Mention").setStyle(TextInputStyle.Short).setRequired(true));
        const roleInput = new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('role_id_input').setLabel("Role ID or @Mention").setStyle(TextInputStyle.Short).setRequired(true));

        switch (selection) {
            case 'settings_set_admin_role':
                modal = new ModalBuilder().setCustomId('settings_modal_admin_role').setTitle('Set Administrator Role');
                modal.addComponents(roleInput);
                break;
            case 'settings_set_raffle_role':
                modal = new ModalBuilder().setCustomId('settings_modal_raffle_role').setTitle('Set Raffle Creator Role');
                modal.addComponents(roleInput);
                break;
            case 'settings_set_analytics_channel':
                modal = new ModalBuilder().setCustomId('settings_modal_analytics_channel').setTitle('Set Analytics Channel');
                modal.addComponents(channelInput);
                break;
            case 'settings_set_clan_dash':
                modal = new ModalBuilder().setCustomId('settings_modal_clan_dash').setTitle('Set Clan Dashboard Channel');
                modal.addComponents(channelInput);
                break;
            case 'settings_set_leaderboard_channel':
                modal = new ModalBuilder().setCustomId('settings_modal_leaderboard_channel').setTitle('Set Solyx™ Leaderboard Channel');
                modal.addComponents(channelInput);
                break;
            case 'settings_set_help_channel':
                modal = new ModalBuilder().setCustomId('settings_modal_help_channel').setTitle('Set Help Dashboard Channel');
                modal.addComponents(channelInput);
                break;
            case 'settings_set_booster_role':
                modal = new ModalBuilder().setCustomId('settings_modal_booster_role').setTitle('Set Booster Role');
                modal.addComponents(roleInput);
                break;
            // --- NEW CASES ---
            case 'settings_set_cmd_list_channel':
                modal = new ModalBuilder().setCustomId('settings_modal_cmd_list_channel').setTitle('Set Public Command List Channel');
                modal.addComponents(channelInput);
                break;
            case 'settings_set_quick_actions_channel':
                modal = new ModalBuilder().setCustomId('settings_modal_quick_actions_channel').setTitle('Set Quick Actions Channel');
                modal.addComponents(channelInput);
                break;
        }
        if (modal) await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit()) {
        await interaction.deferReply({ flags: 64 });
        const customId = interaction.customId;

        if (customId.endsWith('_channel')) {
            const channelId = interaction.fields.getTextInputValue('channel_id_input').match(/\d{17,19}/)?.[0];
            const channel = channelId ? await interaction.guild.channels.fetch(channelId).catch(() => null) : null;
            if (!channel || channel.type !== ChannelType.GuildText) return interaction.editReply({ content: 'Invalid Text Channel ID.' });
            
            // Reusable function to post a dashboard and save IDs
            const postDashboard = async (keyPrefix, content) => {
                db.prepare(`INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, '${keyPrefix}_channel_id', ?)`).run(guildId, channel.id);
                // Clear old message ID to force a new message post
                db.prepare(`DELETE FROM settings WHERE guild_id = ? AND key = '${keyPrefix}_message_id'`).run(guildId);
                const newMessage = await channel.send(content);
                db.prepare(`INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, '${keyPrefix}_message_id', ?)`).run(guildId, newMessage.id);
            };

            switch (customId) {
                case 'settings_modal_analytics_channel':
                    db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'analytics_channel_id', ?)").run(guildId, channel.id);
                    db.prepare("DELETE FROM settings WHERE guild_id = ? AND key = 'analytics_message_id'").run(guildId);
                    await updateAnalyticsDashboard(interaction.client, guildId);
                    await interaction.editReply({ content: `✅ **Analytics Channel** set to ${channel} for this server. The dashboard has been posted.` });
                    break;
                case 'settings_modal_clan_dash':
                    db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'dashboard_channel_id', ?)").run(guildId, channel.id);
                    db.prepare("DELETE FROM settings WHERE guild_id = ? AND key = 'dashboard_message_id'").run(guildId);
                    await sendOrUpdateDashboard(interaction.client, guildId);
                    await interaction.editReply({ content: `✅ **Clan Dashboard Channel** set to ${channel} for this server.` });
                    break;
                case 'settings_modal_leaderboard_channel':
                    db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'leaderboard_channel_id', ?)").run(guildId, channel.id);
                    db.prepare("DELETE FROM settings WHERE guild_id = ? AND key = 'leaderboard_message_id'").run(guildId);
                    await sendOrUpdateLeaderboard(interaction.client, guildId);
                    await interaction.editReply({ content: `✅ **Solyx™ Leaderboard Channel** set to ${channel} for this server.` });
                    break;
                case 'settings_modal_help_channel':
                    await postDashboard('help_dashboard', createHelpDashboard());
                    await interaction.editReply({ content: `✅ **Help Dashboard Channel** set to ${channel} for this server.` });
                    break;
                case 'settings_modal_cmd_list_channel':
                    db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'public_cmd_list_channel_id', ?)").run(guildId, channel.id);
                    db.prepare("DELETE FROM settings WHERE guild_id = ? AND key = 'public_cmd_list_message_id'").run(guildId);
                    await sendOrUpdateCommandList(interaction.client, guildId); // Use manager for initial post
                    await interaction.editReply({ content: `✅ **Public Command List** posted in ${channel}.` });
                    break;
                case 'settings_modal_quick_actions_channel':
                    await postDashboard('quick_actions', createQuickActionsDashboard());
                    await interaction.editReply({ content: `✅ **Quick Actions Hub** has been posted in ${channel}.` });
                    break;
            }
        } else if (customId.endsWith('_role')) {
            const role = await parseRole(interaction.guild, interaction.fields.getTextInputValue('role_id_input'));
            if (!role) return interaction.editReply({ content: 'Invalid Role ID.' });

            switch (customId) {
                case 'settings_modal_admin_role':
                    db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'admin_role_id', ?)").run(guildId, role.id);
                    await interaction.editReply({ content: `✅ **Admin Role** set to ${role} for this server.` });
                    break;
                case 'settings_modal_raffle_role':
                    db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'raffle_creator_role_id', ?)").run(guildId, role.id);
                    await interaction.editReply({ content: `✅ **Raffle Creator Role** set to ${role} for this server.` });
                    break;
                case 'settings_modal_booster_role':
                    db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'booster_role_id', ?)").run(guildId, role.id);
                    await interaction.editReply({ content: `✅ **Booster Role** set to ${role} for this server.` });
                    break;
            }
        }
    }
};