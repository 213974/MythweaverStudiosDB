// src/commands/invite.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('Manage your referrals.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Creates your unique, permanent referral link.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View a list of users you have successfully referred.')),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const user = interaction.user;

        if (subcommand === 'create') {
            try {
                // Check for an existing permanent invite first
                const existingInvites = await interaction.guild.invites.fetch();
                const myInvite = existingInvites.find(inv => inv.inviter.id === user.id && inv.maxUses === 0 && inv.maxAge === 0);

                if (myInvite) {
                    return interaction.reply({ content: `Here is your permanent referral link: ${myInvite.url}`, flags: 64 });
                }

                // If no permanent invite exists, create one
                const newInvite = await interaction.channel.createInvite({
                    maxAge: 0, // never expires
                    maxUses: 0, // unlimited uses
                    unique: true,
                    reason: `Referral link for ${user.tag}`
                });
                
                await interaction.reply({ content: `Your new permanent referral link has been created: ${newInvite.url}`, flags: 64 });

            } catch (error) {
                console.error('Failed to create invite:', error);
                await interaction.reply({ content: 'I could not create an invite link. Please check my permissions in this channel.', flags: 64 });
            }
        } else if (subcommand === 'view') {
            const referredUsers = db.prepare('SELECT user_id FROM users WHERE referred_by = ?').all(user.id);

            const embed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle(`Referrals by ${user.displayName}`)
                .setFooter({ text: `You have successfully referred ${referredUsers.length} user(s).` });
            
            if (referredUsers.length === 0) {
                embed.setDescription('You have not referred any users yet. Use `/invite create` to get your link!');
            } else {
                const userMentions = referredUsers.map(row => `<@${row.user_id}>`).join('\n');
                embed.setDescription(userMentions);
            }

            await interaction.reply({ embeds: [embed], flags: 64 });
        }
    },
};