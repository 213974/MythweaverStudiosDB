// src/handlers/interactions/adminPanel/systemsHandler.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const db = require('../../../utils/database');
const { createSystemsDashboard } = require('../../../components/adminDashboard/systemsPanel');
const { invalidateCache } = require('../../../utils/settingsCache');
const taxManager = require('../../../managers/taxManager');
const guildhallManager = require('../../../managers/guildhallManager');
const dropManager = require('../../../managers/dropManager');

module.exports = async (interaction) => {
    const { customId, guildId } = interaction;

    if (interaction.isStringSelectMenu() && interaction.values[0] === 'admin_panel_systems') {
        await interaction.deferUpdate();
        const response = createSystemsDashboard(guildId);
        return interaction.editReply(response);
    }

    if (interaction.isButton()) {
        if (customId === 'admin_system_toggle_text' || customId === 'admin_system_toggle_vc' || customId === 'admin_system_toggle_drops') {
            await interaction.deferUpdate();
            let key;
            if (customId === 'admin_system_toggle_text') key = 'system_solyx_text_enabled';
            if (customId === 'admin_system_toggle_vc') key = 'system_solyx_vc_enabled';
            if (customId === 'admin_system_toggle_drops') key = 'drop_enabled';
            
            const currentSetting = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = ?").get(guildId, key)?.value;
            const newSetting = currentSetting === 'true' ? 'false' : 'true';
            db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, ?, ?)").run(guildId, key, newSetting);
            invalidateCache(guildId);
            
            const updatedDashboard = createSystemsDashboard(guildId);
            await interaction.editReply(updatedDashboard);

        } else if (customId.startsWith('admin_system_configure_')) {
            let modal;
            const settings = dropManager.getDropSettings(guildId);
            
            if (customId === 'admin_system_configure_rates') {
                const textRate = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'system_solyx_text_rate'").get(guildId)?.value || '0.1';
                const vcRate = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'system_solyx_vc_rate'").get(guildId)?.value || '0.1';
                const vcInterval = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'system_solyx_vc_interval_minutes'").get(guildId)?.value || '5';
                modal = new ModalBuilder().setCustomId('admin_system_modal_configure_rates').setTitle('Configure System Rates');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('text_rate').setLabel("Solyx per Message Rate").setStyle(TextInputStyle.Short).setValue(textRate).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('vc_rate').setLabel("Solyx per Interval in VC").setStyle(TextInputStyle.Short).setValue(vcRate).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('vc_interval').setLabel("VC Interval (Minutes)").setStyle(TextInputStyle.Short).setValue(vcInterval).setRequired(true))
                );
            } else if (customId === 'admin_system_configure_rewards') {
                const dailyReward = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'economy_daily_reward'").get(guildId)?.value || '1';
                const weeklyReward = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'economy_weekly_reward'").get(guildId)?.value || '2';
                modal = new ModalBuilder().setCustomId('admin_system_modal_configure_rewards').setTitle('Configure Claim Rewards');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('daily_reward').setLabel("Daily Reward Amount").setStyle(TextInputStyle.Short).setValue(dailyReward).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('weekly_reward').setLabel("Weekly Reward Amount").setStyle(TextInputStyle.Short).setValue(weeklyReward).setRequired(true))
                );
            } else if (customId === 'admin_system_configure_tax') {
                const currentQuota = taxManager.getTaxQuota(guildId);
                modal = new ModalBuilder().setCustomId('admin_system_modal_configure_tax').setTitle('Configure Clan Tax Quota');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tax_quota').setLabel("Monthly Solyx™ Tax Quota").setStyle(TextInputStyle.Short).setValue(currentQuota.toString()).setRequired(true))
                );
            } else if (customId === 'admin_system_configure_drops') {
                modal = new ModalBuilder().setCustomId('admin_system_modal_configure_drops').setTitle('Configure Solyx Drops');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('drop_interval').setLabel("Drop Interval (30-120 minutes)").setStyle(TextInputStyle.Short).setValue(settings.interval.toString()).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('drop_duration').setLabel("Claim Duration (1-5 minutes)").setStyle(TextInputStyle.Short).setValue((settings.duration / 60).toString()).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('drop_reactors').setLabel("Required Reactors (1-10)").setStyle(TextInputStyle.Short).setValue(settings.requiredReactors.toString()).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('drop_solyx_range').setLabel("Solyx Amount Range").setPlaceholder("e.g., 100 to 1000").setStyle(TextInputStyle.Short).setValue(`${settings.minSolyx} to ${settings.maxSolyx}`).setRequired(true))
                );
            }
            return interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit()) {
        await interaction.deferReply({ flags: 64 });
        
        const runTransaction = (actions) => db.transaction(() => actions.forEach(action => action()))();
        const settingsToUpdate = [];
        const addSetting = (key, value) => settingsToUpdate.push(() => db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, ?, ?)").run(guildId, key, value));

        if (customId === 'admin_system_modal_configure_rates') {
            const textRate = parseFloat(interaction.fields.getTextInputValue('text_rate'));
            const vcRate = parseFloat(interaction.fields.getTextInputValue('vc_rate'));
            const vcInterval = parseInt(interaction.fields.getTextInputValue('vc_interval'), 10);
            if (isNaN(textRate) || textRate < 0 || isNaN(vcRate) || vcRate < 0 || isNaN(vcInterval) || vcInterval < 1) return interaction.editReply({ content: 'Error: All inputs must be valid, positive numbers. Interval must be at least 1 minute.' });
            
            addSetting('system_solyx_text_rate', textRate.toString());
            addSetting('system_solyx_vc_rate', vcRate.toString());
            addSetting('system_solyx_vc_interval_minutes', vcInterval.toString());
            runTransaction(settingsToUpdate);
            invalidateCache(guildId);
        }
        
        if (customId === 'admin_system_modal_configure_rewards') {
            const dailyReward = parseFloat(interaction.fields.getTextInputValue('daily_reward'));
            const weeklyReward = parseFloat(interaction.fields.getTextInputValue('weekly_reward'));
            if (isNaN(dailyReward) || isNaN(weeklyReward)) return interaction.editReply({ content: 'Error: Both daily and weekly rewards must be valid numbers.' });
            
            addSetting('economy_daily_reward', dailyReward.toString());
            addSetting('economy_weekly_reward', weeklyReward.toString());
            runTransaction(settingsToUpdate);
            invalidateCache(guildId);
        }

        if (customId === 'admin_system_modal_configure_tax') {
            const newQuota = parseInt(interaction.fields.getTextInputValue('tax_quota'), 10);
            if (isNaN(newQuota) || newQuota < 0) return interaction.editReply({ content: 'Error: Tax quota must be a valid, non-negative number.' });
            taxManager.setTaxQuota(guildId, newQuota);
            await guildhallManager.syncAllGuildhalls(interaction.client, guildId);
        }

        if (customId === 'admin_system_modal_configure_drops') {
            const interval = parseInt(interaction.fields.getTextInputValue('drop_interval'), 10);
            const duration = parseInt(interaction.fields.getTextInputValue('drop_duration'), 10);
            const reactors = parseInt(interaction.fields.getTextInputValue('drop_reactors'), 10);
            const range = interaction.fields.getTextInputValue('drop_solyx_range').split('to').map(s => parseInt(s.trim(), 10));

            if (isNaN(interval) || interval < 30 || interval > 120) return interaction.editReply({ content: 'Error: Interval must be between 30 and 120 minutes.' });
            if (isNaN(duration) || duration < 1 || duration > 5) return interaction.editReply({ content: 'Error: Duration must be between 1 and 5 minutes.' });
            if (isNaN(reactors) || reactors < 1 || reactors > 10) return interaction.editReply({ content: 'Error: Required reactors must be between 1 and 10.' });
            if (range.length !== 2 || isNaN(range[0]) || isNaN(range[1]) || range[0] < 0 || range[1] <= range[0]) return interaction.editReply({ content: 'Error: Invalid Solyx range format. Use "min to max" with max > min.' });
            
            addSetting('drop_interval_minutes', interval.toString());
            addSetting('drop_duration_seconds', (duration * 60).toString());
            addSetting('drop_reactors_required', reactors.toString());
            addSetting('drop_min_solyx', range[0].toString());
            addSetting('drop_max_solyx', range[1].toString());
            runTransaction(settingsToUpdate);
        }
        
        const updatedDashboard = createSystemsDashboard(guildId);
        await interaction.editReply({ content: '✅ Settings updated successfully!', ...updatedDashboard });
    }
};