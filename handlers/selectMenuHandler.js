// handlers/selectMenuHandler.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const clanManager = require('../utils/clanManager');

async function handleClanDashboardSelect(interaction) {
    const selection = interaction.values[0];
    const user = interaction.user;
    const guild = interaction.guild;

    // Check if the user is in a clan for most actions
    const actingUserClan = clanManager.findClanContainingUser(user.id);

    // --- Actions anyone can attempt ---
    if (selection === 'dashboard_view') {
        if (!actingUserClan) {
            return interaction.reply({ content: "You are not in a clan to view. Use `/clan view <role>` to view a specific one.", flags: 64 });
        }
        // Replicate the logic from /clan view for the user's own clan
        const clanToViewData = actingUserClan;
        const clanToViewRole = await guild.roles.fetch(actingUserClan.clanRoleId).catch(() => null);

        if (!clanToViewRole) {
            return interaction.reply({ content: "Could not find your clan's Discord role. Contact an admin.", flags: 64 });
        }

        const { clanOwnerUserID, motto, viceGuildMasters = [], officers = [], members = [] } = clanToViewData;
        const ownerMention = `<@${clanOwnerUserID}>`;
        const viceGMMentions = viceGuildMasters.length > 0 ? viceGuildMasters.map(id => `<@${id}>`).join(', ') : 'None';
        const officerMentions = officers.length > 0 ? officers.map(id => `<@${id}>`).join(', ') : 'None';
        const memberMentions = members.length > 0 ? members.slice(0, 40).map(id => `<@${id}>`).join(', ') : 'None';

        const embed = new EmbedBuilder()
            .setColor(clanToViewRole.color || '#FFFFFF')
            .setTitle(`${clanToViewRole.name}`)
            .addFields(
                { name: '👑 Owner', value: ownerMention },
                { name: `🛡️ Vice Guild Masters (${viceGuildMasters.length}/${clanManager.MAX_VICE_GUILD_MASTERS})`, value: viceGMMentions },
                { name: `⚔️ Officers (${officers.length}/${clanManager.MAX_OFFICERS})`, value: officerMentions },
                { name: `👥 Members (${members.length}/${clanManager.MAX_MEMBERS})`, value: memberMentions }
            )
            .setTimestamp()
            .setFooter({ text: `Clan Role ID: ${clanToViewRole.id}` });

        if (motto) embed.setDescription(`*“${motto}”*`);

        return interaction.reply({ embeds: [embed], flags: 64 });
    }

    if (selection === 'dashboard_leave') {
        if (!actingUserClan) {
            return interaction.reply({ content: "You are not in a clan.", flags: 64 });
        }
        if (actingUserClan.clanOwnerUserID === user.id) {
            return interaction.reply({ content: "Clan Owners cannot leave their clan.", flags: 64 });
        }

        const clanRole = await guild.roles.fetch(actingUserClan.clanRoleId).catch(() => null);
        const leaveResult = clanManager.removeUserFromClan(actingUserClan.clanRoleId, user.id);

        if (leaveResult.success) {
            const member = await guild.members.fetch(user.id).catch(() => null);
            if (member && clanRole) await member.roles.remove(clanRole).catch(() => { });
            return interaction.reply({ content: `You have successfully left **${clanRole.name}**.`, flags: 64 });
        } else {
            return interaction.reply({ content: `Failed to leave clan: ${leaveResult.message}`, flags: 64 });
        }
    }

    // --- Actions requiring clan membership and permissions ---
    if (!actingUserClan) {
        return interaction.reply({ content: 'You must be in a clan to use this action.', flags: 64 });
    }

    const actorIsOwner = actingUserClan.clanOwnerUserID === user.id;
    const actorIsVice = (actingUserClan.viceGuildMasters || []).includes(user.id);
    const actorIsOfficer = (actingUserClan.officers || []).includes(user.id);

    if (selection === 'dashboard_invite') {
        if (!actorIsOwner && !actorIsVice) return interaction.reply({ content: 'You do not have permission to invite members.', flags: 64 });
        const modal = new ModalBuilder().setCustomId('dashboard_invite_modal').setTitle('Invite Member to Clan');
        const userToInvite = new TextInputBuilder().setCustomId('user_input').setLabel('User ID or @Mention').setStyle(TextInputStyle.Short).setRequired(true);
        const authorityInput = new TextInputBuilder().setCustomId('authority_input').setLabel('Authority (Member, Officer, Vice Guild Master)').setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(userToInvite), new ActionRowBuilder().addComponents(authorityInput));
        await interaction.showModal(modal);
    }

    else if (selection === 'dashboard_kick') {
        if (!actorIsOwner && !actorIsVice && !actorIsOfficer) return interaction.reply({ content: 'You do not have permission to kick members.', flags: 64 });
        const modal = new ModalBuilder().setCustomId('dashboard_kick_modal').setTitle('Kick Member from Clan');
        const userToKick = new TextInputBuilder().setCustomId('user_input').setLabel('User ID or @Mention').setStyle(TextInputStyle.Short).setRequired(true);
        const reasonInput = new TextInputBuilder().setCustomId('reason_input').setLabel('Reason (Optional)').setStyle(TextInputStyle.Paragraph).setRequired(false);
        modal.addComponents(new ActionRowBuilder().addComponents(userToKick), new ActionRowBuilder().addComponents(reasonInput));
        await interaction.showModal(modal);
    }

    else if (selection === 'dashboard_motto') {
        if (!actorIsOwner) return interaction.reply({ content: 'Only the Clan Owner can set the motto.', flags: 64 });
        const modal = new ModalBuilder().setCustomId('dashboard_motto_modal').setTitle('Set Clan Motto');
        const mottoInput = new TextInputBuilder().setCustomId('motto_input').setLabel('Enter new motto (leave blank to remove)').setStyle(TextInputStyle.Paragraph).setRequired(false).setValue(actingUserClan.motto || '');
        modal.addComponents(new ActionRowBuilder().addComponents(mottoInput));
        await interaction.showModal(modal);
    }

    else if (selection === 'dashboard_authority') {
        if (!actorIsOwner && !actorIsVice) return interaction.reply({ content: 'You do not have permission to manage authority.', flags: 64 });
        const modal = new ModalBuilder().setCustomId('dashboard_authority_modal').setTitle('Manage Member Authority');
        const userToManage = new TextInputBuilder().setCustomId('user_input').setLabel('User ID or @Mention').setStyle(TextInputStyle.Short).setRequired(true);
        const authorityInput = new TextInputBuilder().setCustomId('authority_input').setLabel('New Authority (Member, Officer, Vice Guild Master)').setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(userToManage), new ActionRowBuilder().addComponents(authorityInput));
        await interaction.showModal(modal);
    }
}

module.exports = { handleClanDashboardSelect };