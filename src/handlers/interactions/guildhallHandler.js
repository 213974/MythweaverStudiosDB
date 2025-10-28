// src/handlers/interactions/guildhallHandler.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const clanManager = require('../../managers/clanManager');
const taxManager = require('../../managers/taxManager');
const guildhallManager = require('../../managers/guildhallManager');
const walletManager = require('../../managers/economy/walletManager');
const { parseFlexibleAmount } = require('../../helpers/interactionHelpers');

module.exports = async (interaction) => {
    const { customId, user, guild, guildId, member } = interaction;

    if (interaction.isButton() && customId.startsWith('guildhall_contribute_')) {
        const clanId = customId.split('_')[2];
        let userClan = clanManager.findClanContainingUser(guildId, user.id);

        if (!userClan || userClan.clanRoleId !== clanId) {
            if (member.roles.cache.has(clanId)) {
                console.log(`[Auto-Enroll] User ${user.tag} has clan role ${clanId} but is not in DB. Enrolling as Member.`);
                clanManager.addUserToClan(guildId, clanId, user.id, 'Member');
                userClan = clanManager.findClanContainingUser(guildId, user.id);
            } else {
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

    if (interaction.isModalSubmit() && customId.startsWith('guildhall_modal_')) {
        await interaction.deferReply({ flags: 64 });
        const clanId = customId.split('_')[2];
        const amountStr = interaction.fields.getTextInputValue('contribution_amount');
        
        const amount = parseFlexibleAmount(amountStr);

        if (amount === null) {
            return interaction.editReply({ content: '<a:Golden_X:1427763627146088579> Invalid amount. Please provide a valid number (e.g., `100`, `2.5k`).' });
        }
        
        // --- Get balance BEFORE the transaction ---
        const oldBalance = walletManager.getConsolidatedBalance(user.id, guildId);
        const result = taxManager.contributeSolyx(guildId, clanId, user.id, amount);
        
        if (result.success) {
            await guildhallManager.updateGuildhallDashboard(interaction.client, guildId, clanId);
            
            // --- Send a new embed with balance details ---
            const confirmationEmbed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('Guildhall Contribution Successful')
                .setDescription(`Thank you for contributing **${amount.toLocaleString()}** <a:Solyx_Currency:1431059951664627712> to the guildhall!`)
                .addFields(
                    { name: 'Old Balance', value: `${oldBalance.toLocaleString()} <a:Solyx_Currency:1431059951664627712>`, inline: true },
                    { name: 'New Balance', value: `${result.newBalance.toLocaleString()} <a:Solyx_Currency:1431059951664627712>`, inline: true }
                );

            await interaction.editReply({ embeds: [confirmationEmbed] });
        } else {
            await interaction.editReply({ content: `<a:Golden_X:1427763627146088579> ${result.message}` });
        }
    }
};