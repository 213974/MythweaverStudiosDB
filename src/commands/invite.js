// src/commands/invite.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('Manage your referrals.')
        .addSubcommand(subcommand => subcommand.setName('create').setDescription('Creates your unique, permanent referral link.'))
        .addSubcommand(subcommand => subcommand.setName('view').setDescription('View a list of users you have successfully referred.')),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const user = interaction.user;

        if (subcommand === 'create') {
            await interaction.deferReply({ flags: 64 });
            try {
                const existingInvites = await interaction.guild.invites.fetch();
                let myInvite = existingInvites.find(inv => inv.inviter.id === user.id && inv.maxUses === 0 && inv.maxAge === 0);

                if (!myInvite) {
                    myInvite = await interaction.channel.createInvite({
                        maxAge: 0, 
                        maxUses: 0,
                        unique: true,
                        reason: `Referral link for ${user.tag}`
                    });
                }
                
                const embed = new EmbedBuilder()
                    .setColor('#2ECC71')
                    .setTitle('🔗 Your Referral Link')
                    .setDescription('Share this link with others to invite them to the server. You will earn rewards when they join and participate!')
                    .addFields({ name: 'Your unique URL', value: `\`${myInvite.url}\`` });

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Failed to create/fetch invite:', error);
                await interaction.editReply({ content: 'I could not create an invite link. Please check my permissions in this channel.' });
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