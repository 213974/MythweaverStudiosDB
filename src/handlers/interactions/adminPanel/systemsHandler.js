// src/handlers/interactions/adminPanel/systemsHandler.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const db = require('../../../utils/database');
const { createSystemsDashboard } = require('../../../components/adminDashboard/systemsPanel');
const { invalidateCache } = require('../../../utils/settingsCache'); // <-- IMPORT THE FIX

module.exports = async (interaction) => {
    const { customId, guildId } = interaction;

    if (interaction.isButton()) {
        if (customId === 'admin_system_toggle_text') {
            await interaction.deferUpdate();
            const currentSetting = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'system_solyx_text_enabled'").get(guildId)?.value;
            const newSetting = currentSetting === 'true' ? 'false' : 'true';
            db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'system_solyx_text_enabled', ?)").run(guildId, newSetting);
            invalidateCache(guildId); // <-- APPLY THE FIX
        } else if (customId === 'admin_system_toggle_vc') {
            await interaction.deferUpdate();
            const currentSetting = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'system_solyx_vc_enabled'").get(guildId)?.value;
            const newSetting = currentSetting === 'true' ? 'false' : 'true';
            db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'system_solyx_vc_enabled', ?)").run(guildId, newSetting);
            invalidateCache(guildId); // <-- APPLY THE FIX
        } else if (customId === 'admin_system_configure') {
            const settings = db.prepare("SELECT key, value FROM settings WHERE guild_id = ? AND key LIKE 'system_solyx_%'").all(guildId);
            const settingsMap = new Map(settings.map(s => [s.key, s.value]));
            
            const modal = new ModalBuilder().setCustomId('admin_system_modal_configure').setTitle('Configure System Rates');
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('text_rate').setLabel("Solyx per Message Rate").setStyle(TextInputStyle.Short).setValue(settingsMap.get('system_solyx_text_rate') || '0.1').setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('vc_rate').setLabel("Solyx per Interval in VC").setStyle(TextInputStyle.Short).setValue(settingsMap.get('system_solyx_vc_rate') || '0.1').setRequired(true)
                ),
                 new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('vc_interval').setLabel("VC Interval (Minutes)").setStyle(TextInputStyle.Short).setValue(settingsMap.get('system_solyx_vc_interval_minutes') || '5').setRequired(true)
                )
            );
            return interaction.showModal(modal);
        }

        // After any button press that updates state, refresh the dashboard
        const updatedDashboard = createSystemsDashboard(guildId);
        await interaction.editReply(updatedDashboard);
    }

    if (interaction.isModalSubmit() && customId === 'admin_system_modal_configure') {
        await interaction.deferUpdate();

        const textRate = parseFloat(interaction.fields.getTextInputValue('text_rate'));
        const vcRate = parseFloat(interaction.fields.getTextInputValue('vc_rate'));
        const vcInterval = parseInt(interaction.fields.getTextInputValue('vc_interval'), 10);

        if (isNaN(textRate) || textRate < 0 || isNaN(vcRate) || vcRate < 0 || isNaN(vcInterval) || vcInterval < 1) {
             await interaction.followUp({ content: 'Error: All inputs must be valid, positive numbers. Interval must be at least 1 minute.', flags: 64 });
        } else {
            db.transaction(() => {
                db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'system_solyx_text_rate', ?)").run(guildId, textRate.toString());
                db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'system_solyx_vc_rate', ?)").run(guildId, vcRate.toString());
                db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'system_solyx_vc_interval_minutes', ?)").run(guildId, vcInterval.toString());
            })();
            invalidateCache(guildId); // <-- APPLY THE FIX
        }
        
        const updatedDashboard = createSystemsDashboard(guildId);
        await interaction.editReply(updatedDashboard);
    }
};