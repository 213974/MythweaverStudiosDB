// src/handlers/interactions/guildhallHandler.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const clanManager = require('../../managers/clanManager');
const taxManager = require('../../managers/taxManager');
const guildhallManager = require('../../managers/guildhallManager');
const { parseFlexibleAmount } = require('../../helpers/interactionHelpers');

module.exports = async (interaction) => {
    const { customId, user, guild, guildId, member } = interaction;

    // --- Button Click: Open Modal ---
    if (interaction.isButton() && customId.startsWith('guildhall_contribute_')) {
        const clanId = customId.split('_')[2];
        let userClan = clanManager.findClanContainingUser(guildId, user.id);

        // --- Automatic Enrollment Logic ---
        // If the user is not found in the clan's DB records...
        if (!userClan || userClan.clanRoleId !== clanId) {
            // ...but they DO have the corresponding Discord role...
            if (member.roles.cache.has(clanId)) {
                // ...add them to the clan as a 'Member' automatically.
                console.log(`[Auto-Enroll] User ${user.tag} has clan role ${clanId} but is not in DB. Enrolling as Member.`);
                clanManager.addUserToClan(guildId, clanId, user.id, 'Member');
                // Re-fetch clan data to proceed.
                userClan = clanManager.findClanContainingUser(guildId, user.id);
            } else {
                // If they don't have the role, deny access as before.
                return interaction.reply({ content: 'You can only contribute to your own clan.', flags: 64 });
            }
        }

        const modal = new ModalBuilder()
            .setCustomId(`guildhall_modal_${clanId}`)
            .setTitle('Contribute Solyx™ to Guildhall');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('contribution_amount')
                    .setLabel(`Amount to Contribute (Min: ${taxManager.MINIMUM_CONTRIBUTION})`)
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g., 100 or 2.5k')
                    .setRequired(true)
            )
        );
        await interaction.showModal(modal);
    }

    // --- Modal Submit: Process Contribution ---
    if (interaction.isModalSubmit() && customId.startsWith('guildhall_modal_')) {
        await interaction.deferReply({ flags: 64 });
        const clanId = customId.split('_')[2];
        const amountStr = interaction.fields.getTextInputValue('contribution_amount');
        
        // --- Use the flexible parser ---
        const amount = parseFlexibleAmount(amountStr);

        if (amount === null) {
            return interaction.editReply({ content: '<a:Golden_X:1427763627146088579> Invalid amount. Please provide a valid number (e.g., `100`, `2.5k`).' });
        }

        const result = taxManager.contributeSolyx(guildId, clanId, user.id, amount);
        
        if (result.success) {
            // After a successful contribution, update the dashboard immediately.
            await guildhallManager.updateGuildhallDashboard(interaction.client, guildId, clanId);
            await interaction.editReply({ content: `<a:Golden_Check:1427763589732634746> ${result.message}` });
        } else {
            await interaction.editReply({ content: `<a:Golden_X:1427763627146088579> ${result.message}` });
        }
    }
};