// src/handlers/interactions/devInteractionHandler.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ChannelType, EmbedBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder } = require('discord.js');
const config = require('../../config');
const db = require('../../utils/database');
const { parseRole } = require('../../helpers/interactionHelpers');
const { sendOrUpdateDashboard } = require('../../managers/dashboardManager');
const { sendOrUpdateLeaderboard } = require('../../managers/leaderboardManager');
const { updateAnalyticsDashboard } = require('../../utils/scheduler');
const { sendOrUpdateCommandList } = require('../../managers/publicCommandListManager');
const { sendOrUpdateQuickActions } = require('../../managers/quickActionsManager');
const taxManager = require('../../managers/taxManager');
const guildhallManager = require('../../managers/guildhallManager');
const { sendOrUpdateHelpDashboard } = require('../../managers/helpDashboardManager');

function createDropChannelDashboard(guildId) {
    const currentMode = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'drop_channel_mode'").get(guildId)?.value || 'whitelist';
    const channelsJson = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'drop_channels'").get(guildId)?.value || '[]';
    const channels = JSON.parse(channelsJson);

    const embed = new EmbedBuilder()
        .setColor('#1ABC9C')
        .setTitle('💎 Manage Solyx Drop Channels')
        .setDescription(`Configure which channels are eligible for random Solyx drops.\n\nCurrent Mode: **${currentMode.toUpperCase()}**\n*Whitelist: Drops only appear in listed channels.\nBlacklist: Drops appear in any channel EXCEPT listed ones.*`)
        .addFields({ name: 'Managed Channels', value: channels.length > 0 ? channels.map(id => `<#${id}>`).join('\n') : '`None`' });

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('settings_drop_mode_toggle').setLabel(`Switch to ${currentMode === 'whitelist' ? 'Blacklist' : 'Whitelist'} Mode`).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('settings_drop_channels_add').setLabel('Add Channels').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('settings_drop_channels_remove').setLabel('Remove Channels').setStyle(ButtonStyle.Danger),
    );
    return { embeds: [embed], components: [row1] };
}


module.exports = async (interaction) => {
    if (!config.ownerIDs.includes(interaction.user.id)) {
        return interaction.reply({ content: 'You do not have permission to use this component.', flags: 64 });
    }

    const guildId = interaction.guild.id;

    // --- BUTTON HANDLERS FOR DROP CHANNELS ---
    if (interaction.isButton() && interaction.customId.startsWith('settings_drop_')) {
        if (interaction.customId === 'settings_drop_mode_toggle') {
            const currentMode = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'drop_channel_mode'").get(guildId)?.value || 'whitelist';
            const newMode = currentMode === 'whitelist' ? 'blacklist' : 'whitelist';
            db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'drop_channel_mode', ?)").run(guildId, newMode);
        } else { // add or remove channels
            const isAdding = interaction.customId === 'settings_drop_channels_add';
            const modal = new ModalBuilder()
                .setCustomId(isAdding ? 'settings_modal_drop_add' : 'settings_modal_drop_remove')
                .setTitle(isAdding ? 'Add Drop Channels' : 'Remove Drop Channels');
            
            modal.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('channels_input').setLabel("Channel IDs or #Mentions (comma-separated)").setStyle(TextInputStyle.Paragraph).setRequired(true)
            ));
            return interaction.showModal(modal);
        }
        await interaction.update(createDropChannelDashboard(guildId));
    }


    if (interaction.isStringSelectMenu()) {
        const selection = interaction.values[0];

        if (selection === 'settings_manage_drop_channels') {
            return interaction.reply({ ...createDropChannelDashboard(guildId), flags: 64 });
        }

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
            case 'settings_set_cmd_list_channel':
                modal = new ModalBuilder().setCustomId('settings_modal_cmd_list_channel').setTitle('Set Public Command List Channel');
                modal.addComponents(channelInput);
                break;
            case 'settings_set_quick_actions_channel':
                modal = new ModalBuilder().setCustomId('settings_modal_quick_actions_channel').setTitle('Set Quick Actions Channel');
                modal.addComponents(channelInput);
                break;
            case 'settings_set_guildhall_category':
                modal = new ModalBuilder().setCustomId('settings_modal_guildhall_category').setTitle('Set Guildhalls Category');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('category_id_input').setLabel("Category ID or Name").setStyle(TextInputStyle.Short).setRequired(true)));
                break;
            case 'settings_set_welcome_channel':
                 modal = new ModalBuilder().setCustomId('settings_modal_welcome_channel').setTitle('Set Welcome Channel');
                 modal.addComponents(channelInput);
                 break;
        }
        if (modal) await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('settings_modal_drop_')) {
            await interaction.deferUpdate();
            const isAdding = interaction.customId.endsWith('_add');
            const input = interaction.fields.getTextInputValue('channels_input');
            const channelIds = input.match(/\d{17,19}/g) || [];

            if (channelIds.length > 0) {
                const channelsJson = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'drop_channels'").get(guildId)?.value || '[]';
                const currentChannels = new Set(JSON.parse(channelsJson));

                if (isAdding) {
                    channelIds.forEach(id => currentChannels.add(id));
                } else {
                    channelIds.forEach(id => currentChannels.delete(id));
                }
                
                db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'drop_channels', ?)").run(guildId, JSON.stringify([...currentChannels]));
            }
            return interaction.editReply(createDropChannelDashboard(guildId));
        }


        await interaction.deferReply({ flags: 64 });
        const customId = interaction.customId;

        if (customId.endsWith('_channel')) {
            const channelId = interaction.fields.getTextInputValue('channel_id_input').match(/\d{17,19}/)?.[0];
            const channel = channelId ? await interaction.guild.channels.fetch(channelId).catch(() => null) : null;
            if (!channel || channel.type !== ChannelType.GuildText) return interaction.editReply({ content: 'Invalid Text Channel ID.' });

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
                    db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'help_dashboard_channel_id', ?)").run(guildId, channel.id);
                    await sendOrUpdateHelpDashboard(interaction.client, guildId);
                    await interaction.editReply({ content: `✅ **Help Dashboard Channel** set to ${channel} for this server. The dashboard has been posted.` });
                    break;
                case 'settings_modal_cmd_list_channel':
                    db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'public_cmd_list_channel_id', ?)").run(guildId, channel.id);
                    db.prepare("DELETE FROM settings WHERE guild_id = ? AND key = 'public_cmd_list_message_id'").run(guildId);
                    await sendOrUpdateCommandList(interaction.client, guildId);
                    await interaction.editReply({ content: `✅ **Public Command List** posted in ${channel}.` });
                    break;
                case 'settings_modal_quick_actions_channel':
                    db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'quick_actions_channel_id', ?)").run(guildId, channel.id);
                    await sendOrUpdateQuickActions(interaction.client, guildId);
                    await interaction.editReply({ content: `✅ **Quick Actions Hub** has been posted in ${channel}.` });
                    break;
                case 'settings_modal_welcome_channel':
                    db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'welcome_channel_id', ?)").run(guildId, channel.id);
                    await interaction.editReply({ content: `✅ **Welcome Channel** set to ${channel} for this server.` });
                    break;
            }
        } else if (customId.endsWith('_role')) {
            const role = await parseRole(interaction.guild, interaction.fields.getTextInputValue('role_id_input'));
            if (!role) return interaction.editReply({ content: 'Invalid Role ID.' });
        } else if (customId === 'settings_modal_guildhall_category') {
            const categoryInput = interaction.fields.getTextInputValue('category_id_input');
            const categoryId = categoryInput.match(/\d{17,19}/)?.[0];
            let category;

            if (categoryId) {
                category = await interaction.guild.channels.fetch(categoryId).catch(() => null);
            } else {
                category = interaction.guild.channels.cache.find(c => c.name.toLowerCase() === categoryInput.toLowerCase() && c.type === ChannelType.GuildCategory);
            }
            
            if (!category || category.type !== ChannelType.GuildCategory) {
                return interaction.editReply({ content: 'Invalid Category ID or Name.' });
            }

            taxManager.setGuildhallCategoryId(guildId, category.id);
            await guildhallManager.syncAllGuildhalls(interaction.client, guildId);

            await interaction.editReply({ content: `✅ **Guildhalls Category** set to **${category.name}**. All guildhall channels have been synchronized.` });
        }
    }
};