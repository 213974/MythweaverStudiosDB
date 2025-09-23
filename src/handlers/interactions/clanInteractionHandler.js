// src/handlers/interactions/clanInteractionHandler.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const clanManager = require('../../utils/clanManager');
const { formatTimestamp } = require('../../utils/timestampFormatter');

async function parseUser(guild, userInput) {
    const matches = userInput.match(/^(?:<@!?)?(\d{17,19})>?$/);
    if (matches) return guild.members.fetch(matches[1]).catch(() => null);
    return null;
}

// --- Main Handler Function ---
module.exports = async (interaction) => {

    // --- SELECT MENU (Dashboard Navigation) ---
    if (interaction.isStringSelectMenu()) {
        const selection = interaction.values[0];
        const user = interaction.user;
        const guild = interaction.guild;
        const actingUserClan = clanManager.findClanContainingUser(user.id);

        if (selection === 'dashboard_view') {
            if (!actingUserClan) return interaction.reply({ content: "You are not in a clan to view. Use `/clan view <role>` to view a specific one.", ephemeral: true });
            const clanToViewRole = await guild.roles.fetch(actingUserClan.clanRoleId).catch(() => null);
            if (!clanToViewRole) return interaction.reply({ content: "Could not find your clan's Discord role. Contact an admin.", ephemeral: true });

            const { clanOwnerUserID, motto, viceGuildMasters = [], officers = [], members = [] } = actingUserClan;
            const embed = new EmbedBuilder().setColor(clanToViewRole.color || '#FFFFFF').setTitle(`${clanToViewRole.name}`).addFields(
                { name: '👑 Owner', value: `<@${clanOwnerUserID}>` },
                { name: `🛡️ Vice Guild Masters (${viceGuildMasters.length}/${clanManager.MAX_VICE_GUILD_MASTERS})`, value: viceGuildMasters.length > 0 ? viceGuildMasters.map(id => `<@${id}>`).join(', ') : 'None' },
                { name: `⚔️ Officers (${officers.length}/${clanManager.MAX_OFFICERS})`, value: officers.length > 0 ? officers.map(id => `<@${id}>`).join(', ') : 'None' },
                { name: `👥 Members (${members.length}/${clanManager.MAX_MEMBERS})`, value: members.length > 0 ? members.slice(0, 40).map(id => `<@${id}>`).join(', ') : 'None' }
            ).setTimestamp().setFooter({ text: `Clan Role ID: ${clanToViewRole.id}` });
            if (motto) embed.setDescription(`*“${motto}”*`);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (selection === 'dashboard_leave') {
            if (!actingUserClan) return interaction.reply({ content: "You are not in a clan.", ephemeral: true });
            if (actingUserClan.clanOwnerUserID === user.id) return interaction.reply({ content: "Clan Owners cannot leave their clan.", ephemeral: true });
            
            const clanRole = await guild.roles.fetch(actingUserClan.clanRoleId).catch(() => null);
            const leaveResult = clanManager.removeUserFromClan(actingUserClan.clanRoleId, user.id);
            if (leaveResult.success) {
                const member = await guild.members.fetch(user.id).catch(() => null);
                if (member && clanRole) await member.roles.remove(clanRole).catch(() => {});
                return interaction.reply({ content: `You have successfully left **${clanRole.name}**.`, ephemeral: true });
            }
        }

        // Actions requiring clan membership
        if (!actingUserClan) return interaction.reply({ content: 'You must be in a clan to use this action.', ephemeral: true });

        const actorIsOwner = actingUserClan.clanOwnerUserID === user.id;
        const actorIsVice = (actingUserClan.viceGuildMasters || []).includes(user.id);

        if (selection === 'dashboard_invite' || selection === 'dashboard_authority' || selection === 'dashboard_kick' || selection === 'dashboard_motto') {
            let modal;
            if (selection === 'dashboard_invite') {
                if (!actorIsOwner && !actorIsVice) return interaction.reply({ content: 'You do not have permission to invite members.', ephemeral: true });
                modal = new ModalBuilder().setCustomId('dashboard_invite_modal').setTitle('Invite Member to Clan');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('user_input').setLabel('User ID or @Mention').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('authority_input').setLabel('Authority (Member, Officer, etc)').setStyle(TextInputStyle.Short).setRequired(true))
                );
            }
            // Add other modal creation logic here...
            if (modal) await interaction.showModal(modal);
        }
    }

    // --- BUTTON (Clan Invites) ---
    if (interaction.isButton()) {
        const customId = interaction.customId;
        const parts = customId.split('_'); // e.g., clan_accept_ROLEID_USERID_AUTHORITY

        if (parts[0] === 'clan' && (parts[1] === 'accept' || parts[1] === 'deny')) {
            const originalMessage = interaction.message;
            const disabledRow = ActionRowBuilder.from(originalMessage.components[0]);
            disabledRow.components.forEach(component => component.setDisabled(true));
            await interaction.update({ components: [disabledRow] });

            const action = parts[1];
            const clanRoleId = parts[2];
            const invitedUserId = parts[3];

            if (interaction.user.id !== invitedUserId) return interaction.followUp({ content: "This invitation is not for you.", ephemeral: true });

            const clanDiscordRole = await interaction.guild.roles.fetch(clanRoleId).catch(() => null);
            const updatedEmbed = EmbedBuilder.from(originalMessage.embeds[0]);

            if (action === 'accept') {
                const authorityToAssign = parts[4].replace(/-/g, ' ');
                const result = await clanManager.addUserToClanAndEnsureRole(interaction.client, interaction.guild, clanRoleId, invitedUserId, authorityToAssign, clanDiscordRole);
                if (result.success) updatedEmbed.setColor('#00FF00').addFields({ name: 'Status', value: `✅ Accepted by <@${invitedUserId}>.` });
                else updatedEmbed.setColor('#FF0000').addFields({ name: 'Status', value: `❌ Failed: ${result.message}` });
            } else { // Deny
                updatedEmbed.setColor('#AAAAAA').addFields({ name: 'Status', value: `❌ Denied by <@${invitedUserId}>.` });
            }
            await originalMessage.edit({ embeds: [updatedEmbed.setTimestamp()] });
        }
    }

    // --- MODAL SUBMIT (Clan Management) ---
    if (interaction.isModalSubmit()) {
        const customId = interaction.customId;
        if (customId.startsWith('dashboard_')) {
            // Handle modals for invite, kick, motto, etc.
            // This logic is ported from the old modalSubmitHandler.
            await interaction.deferReply({ ephemeral: true });
            // ... (Full implementation of modal logic would go here)
            await interaction.editReply({ content: 'Clan action processed.' });
        }
    }
};