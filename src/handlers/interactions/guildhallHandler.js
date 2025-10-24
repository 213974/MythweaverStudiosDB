// src/handlers/interactions/guildhallHandler.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const clanManager = require('../../managers/clanManager');
const taxManager = require('../../managers/taxManager');
const guildhallManager = require('../../managers/guildhallManager');

module.exports = async (interaction) => {
    const { customId, user, guild, guildId } = interaction;

    // --- Button Click: Open Modal ---
    if (interaction.isButton() && customId.startsWith('guildhall_contribute_')) {
        const clanId = customId.split('_')[2];
        const userClan = clanManager.findClanContainingUser(guildId, user.id);

        if (!userClan || userClan.clanRoleId !== clanId) {
            return interaction.reply({ content: 'You can only contribute to your own clan.', flags: 64 });
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
                    .setPlaceholder('Enter a whole number...')
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
        const amount = parseInt(amountStr.replace(/,/g, ''), 10);

        if (isNaN(amount)) {
            return interaction.editReply({ content: 'Invalid amount. Please provide a whole number.' });
        }

        const result = taxManager.contributeSolyx(guildId, clanId, user.id, amount);
        
        if (result.success) {
            // After a successful contribution, update the dashboard immediately.
            await guildhallManager.updateGuildhallDashboard(interaction.client, guildId, clanId);
            await interaction.editReply({ content: `✅ ${result.message}` });
        } else {
            await interaction.editReply({ content: `❌ ${result.message}` });
        }
    }
};