// src/commands/clan/view.js
const { EmbedBuilder } = require('discord.js');
const clanManager = require('../../utils/clanManager');

module.exports = {
    async execute(interaction, guildId, userClanData) {
        const specifiedRole = interaction.options.getRole('clanrole');
        let clanToViewData;
        let clanToViewRole;

        if (specifiedRole) {
            clanToViewData = clanManager.getClanData(guildId, specifiedRole.id);
            if (!clanToViewData) return interaction.reply({ content: `**${specifiedRole.name}** is not a registered clan in this server.`, flags: 64 });
            clanToViewRole = specifiedRole;
        } else {
            if (!userClanData) return interaction.reply({ content: "You are not in a clan in this server. Specify a clan role to view its details.", flags: 64 });
            clanToViewData = userClanData;
            clanToViewRole = await interaction.guild.roles.fetch(userClanData.clanRoleId).catch(() => null);
            if (!clanToViewRole) return interaction.reply({ content: "Could not find your clan's Discord role.", flags: 64 });
        }

        await interaction.deferReply({ flags: 64 });

        const { clanOwnerUserID, motto, viceGuildMasters = [], officers = [], members = [] } = clanToViewData;
        const embed = new EmbedBuilder().setColor(clanToViewRole.color || '#FFFFFF').setTitle(`${clanToViewRole.name}`).addFields(
            { name: '👑 Owner', value: `<@${clanOwnerUserID}>` },
            { name: `🛡️ Vice Guild Masters (${viceGuildMasters.length}/${clanManager.MAX_VICE_GUILD_MASTERS})`, value: viceGuildMasters.length > 0 ? viceGuildMasters.map(id => `<@${id}>`).join(', ') : 'None' },
            { name: `⚔️ Officers (${officers.length}/${clanManager.MAX_OFFICERS})`, value: officers.length > 0 ? officers.map(id => `<@${id}>`).join(', ') : 'None' },
            { name: `👥 Members (${members.length}/${clanManager.MAX_MEMBERS})`, value: members.length > 0 ? members.slice(0, 40).map(id => `<@${id}>`).join(', ') : 'None' }
        ).setTimestamp().setFooter({ text: `Clan Role ID: ${clanToViewRole.id}` });
        if (motto) embed.setDescription(`*“${motto}”*`);

        await interaction.editReply({ embeds: [embed] });
    }
};