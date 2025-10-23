// src/handlers/interactions/adminPanel/systemsHandler.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const db = require('../../../utils/database');
const { createSystemsDashboard } = require('../../../components/adminDashboard/systemsPanel');
const { invalidateCache } = require('../../../utils/settingsCache');

module.exports = async (interaction) => {
    const { customId, guildId } = interaction;

    if (interaction.isStringSelectMenu() && interaction.values[0] === 'admin_panel_systems') {
        await interaction.deferUpdate(); // Acknowledge the select menu press
        const response = createSystemsDashboard(guildId);
        return interaction.editReply(response);
    }

    if (interaction.isButton()) {
        await interaction.deferUpdate(); // Acknowledge the button press
        
        if (customId === 'admin_system_toggle_text') {
            const currentSetting = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'system_solyx_text_enabled'").get(guildId)?.value;
            const newSetting = currentSetting === 'true' ? 'false' : 'true';
            db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'system_solyx_text_enabled', ?)").run(guildId, newSetting);
            invalidateCache(guildId);
        } else if (customId === 'admin_system_toggle_vc') {
            const currentSetting = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'system_solyx_vc_enabled'").get(guildId)?.value;
            const newSetting = currentSetting === 'true' ? 'false' : 'true';
            db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'system_solyx_vc_enabled', ?)").run(guildId, newSetting);
            invalidateCache(guildId);
        } else if (customId === 'admin_system_configure_rates' || customId === 'admin_system_configure_rewards') {
            // Modal submissions are new interactions, so we can't editReply after this.
            // We just show the modal and the flow ends here for this interaction.
            let modal;
            if (customId === 'admin_system_configure_rates') {
                const settings = db.prepare("SELECT key, value FROM settings WHERE guild_id = ? AND key LIKE 'system_solyx_%'").all(guildId);
                const settingsMap = new Map(settings.map(s => [s.key, s.value]));
                modal = new ModalBuilder().setCustomId('admin_system_modal_configure_rates').setTitle('Configure System Rates');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('text_rate').setLabel("Solyx per Message Rate").setStyle(TextInputStyle.Short).setValue(settingsMap.get('system_solyx_text_rate') || '0.1').setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('vc_rate').setLabel("Solyx per Interval in VC").setStyle(TextInputStyle.Short).setValue(settingsMap.get('system_solyx_vc_rate') || '0.1').setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('vc_interval').setLabel("VC Interval (Minutes)").setStyle(TextInputStyle.Short).setValue(settingsMap.get('system_solyx_vc_interval_minutes') || '5').setRequired(true))
                );
            } else { // configure_rewards
                const settings = db.prepare("SELECT key, value FROM settings WHERE guild_id = ? AND key LIKE 'economy_%_reward'").all(guildId);
                const settingsMap = new Map(settings.map(s => [s.key, s.value]));
                modal = new ModalBuilder().setCustomId('admin_system_modal_configure_rewards').setTitle('Configure Claim Rewards');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('daily_reward').setLabel("Daily Reward Amount").setStyle(TextInputStyle.Short).setValue(settingsMap.get('economy_daily_reward') || '1').setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('weekly_reward').setLabel("Weekly Reward Amount").setStyle(TextInputStyle.Short).setValue(settingsMap.get('economy_weekly_reward') || '2').setRequired(true))
                );
            }
            // showModal implicitly replies to the interaction.
            return interaction.showModal(modal);
        }

        // After toggle button presses, refresh the dashboard
        const updatedDashboard = createSystemsDashboard(guildId);
        await interaction.editReply(updatedDashboard);
    }

    if (interaction.isModalSubmit()) {
        await interaction.deferReply({ flags: 64 }); // Acknowledge the new modal interaction

        if (customId === 'admin_system_modal_configure_rates') {
            const textRate = parseFloat(interaction.fields.getTextInputValue('text_rate'));
            const vcRate = parseFloat(interaction.fields.getTextInputValue('vc_rate'));
            const vcInterval = parseInt(interaction.fields.getTextInputValue('vc_interval'), 10);

            if (isNaN(textRate) || textRate < 0 || isNaN(vcRate) || vcRate < 0 || isNaN(vcInterval) || vcInterval < 1) {
                 return interaction.editReply({ content: 'Error: All inputs must be valid, positive numbers. Interval must be at least 1 minute.' });
            }
            db.transaction(() => {
                db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'system_solyx_text_rate', ?)").run(guildId, textRate.toString());
                db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'system_solyx_vc_rate', ?)").run(guildId, vcRate.toString());
                db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'system_solyx_vc_interval_minutes', ?)").run(guildId, vcInterval.toString());
            })();
            invalidateCache(guildId);
        }
        
        if (customId === 'admin_system_modal_configure_rewards') {
            const dailyReward = parseFloat(interaction.fields.getTextInputValue('daily_reward'));
            const weeklyReward = parseFloat(interaction.fields.getTextInputValue('weekly_reward'));

            if (isNaN(dailyReward) || isNaN(weeklyReward)) {
                return interaction.editReply({ content: 'Error: Both daily and weekly rewards must be valid numbers.' });
            }
            db.transaction(() => {
                db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'economy_daily_reward', ?)").run(guildId, dailyReward.toString());
                db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'economy_weekly_reward', ?)").run(guildId, weeklyReward.toString());
            })();
            invalidateCache(guildId);
        }
        
        // After the modal is processed, we must generate and show the *original* admin dashboard again.
        // The original interaction (the button that opened the modal) is now gone, so we reply
        // to the modal's interaction with the updated dashboard.
        const updatedDashboard = createSystemsDashboard(guildId);
        await interaction.editReply({ content: '✅ Settings updated successfully!', ...updatedDashboard });
    }
};