// src/handlers/interactions/adminPanel/eventHandler.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../../utils/database');
const config = require('../../../config');
const chrono = require('chrono-node');
const { formatTimestamp } = require('../../../utils/timestampFormatter');
const { createEventDashboard } = require('../../../components/adminDashboard/eventPanel');

module.exports = async (interaction) => {
    const { customId, guild, user, client } = interaction;
    const guildId = guild.id;

    if (interaction.isButton()) {
        if (customId === 'admin_event_configure') {
            const modal = new ModalBuilder()
                .setCustomId('admin_event_modal_configure')
                .setTitle('Configure "Solyx per Message" Event');
            
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('reward_input').setLabel("Solyx™ per message (e.g., 0.1)").setStyle(TextInputStyle.Short).setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('duration_input').setLabel("Event Duration (e.g., '3h', '1d 12h')").setStyle(TextInputStyle.Short).setRequired(true)
                )
            );
            await interaction.showModal(modal);
        }

        if (customId === 'admin_event_cancel') {
            await interaction.deferUpdate();
            db.prepare("DELETE FROM settings WHERE guild_id = ? AND key LIKE 'event_%'").run(guildId);
            client.activeEvents.delete(guildId);

            const updatedDashboard = createEventDashboard(guildId);
            await interaction.editReply(updatedDashboard);
            
            await interaction.followUp({ content: '<a:Golden_Check:1427763589732634746> The active event has been successfully cancelled.', flags: 64 });
        }
    }

    if (interaction.isModalSubmit()) {
        if (customId === 'admin_event_modal_configure') {
            await interaction.deferReply({ flags: 64 });

            const reward = parseFloat(interaction.fields.getTextInputValue('reward_input'));
            const durationStr = interaction.fields.getTextInputValue('duration_input');
            const endDate = chrono.parseDate(durationStr, new Date(), { forwardDate: true });

            if (isNaN(reward) || reward <= 0) {
                return interaction.editReply({ content: 'Error: Invalid reward amount. Please provide a positive number.', flags: 64 });
            }
            if (!endDate) {
                return interaction.editReply({ content: "Error: Invalid duration format. Please try something like '3 hours' or '1d 12h'.", flags: 64 });
            }

            const endTimestamp = Math.floor(endDate.getTime() / 1000);

            const eventData = {
                type: 'message',
                reward: reward,
                endTimestamp: endTimestamp,
                startedBy: user.id
            };
            
            db.transaction(() => {
                db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'event_type', ?)").run(guildId, eventData.type);
                db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'event_reward', ?)").run(guildId, eventData.reward);
                db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'event_end_timestamp', ?)").run(guildId, eventData.endTimestamp);
                db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'event_started_by', ?)").run(guildId, eventData.startedBy);
            })();
            
            client.activeEvents.set(guildId, eventData);
            
            await interaction.editReply({ content: `<a:Golden_Check:1427763589732634746> Event started successfully! I am notifying the bot owners.`, flags: 64 });
            
            const updatedDashboard = createEventDashboard(guildId);
            await interaction.followUp({ ...updatedDashboard, flags: 64 });

            // Send DM to owners
            const notificationEmbed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('📢 Event Started!')
                .setDescription(`An event was just started by **${user.tag}**.`)
                .setFields(
                    { name: 'Server', value: guild.name, inline: true },
                    { name: 'Reward', value: `**${reward}** Solyx™ per message`, inline: true },
                    { name: 'Ends', value: formatTimestamp(endTimestamp), inline: true }
                )
                .setTimestamp();

            for (const ownerId of config.ownerIDs) {
                try {
                    const owner = await client.users.fetch(ownerId);
                    await owner.send({ embeds: [notificationEmbed] });
                } catch (err) {
                    console.error(`[EventHandler] Failed to DM owner ${ownerId}:`, err);
                }
            }
        }
    }
};