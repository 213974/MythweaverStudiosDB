// commands/admin/adminEconomy.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const economyManager = require('../../utils/economyManager');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin-economy')
        .setDescription('Manage user economy balances.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('action')
                .setDescription('The action to perform.')
                .setRequired(true)
                .addChoices(
                    { name: 'Give', value: 'give' },
                    { name: 'Remove', value: 'remove' },
                    { name: 'Set', value: 'set' }
                ))
        .addStringOption(option =>
            option.setName('currency')
                .setDescription('The currency to modify.')
                .setRequired(true)
                .addChoices({ name: 'Gold', value: 'Gold' }))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The target user.')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('The amount of currency.')
                .setRequired(true)
                .setMinValue(0))
        .addStringOption(option =>
            option.setName('destination')
                .setDescription('Where to apply the action. Defaults to Player Balance (Bank).')
                .setRequired(false)
                .addChoices(
                    { name: 'Player Balance (Bank)', value: 'bank' },
                    { name: 'Sanctuary Balance', value: 'balance' }
                ))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('The reason for this administrative action.')
                .setRequired(false)),

    async execute(interaction) {
        if (interaction.user.id !== config.ownerID && !interaction.member.roles.cache.has(config.serverAdminRoleID)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: 64 });
        }

        await interaction.deferReply({ flags: 64 });

        const action = interaction.options.getString('action');
        const currency = interaction.options.getString('currency');
        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const destination = interaction.options.getString('destination') ?? 'bank'; // Default to bank (Player Balance)
        const reason = interaction.options.getString('reason');

        economyManager.ensureUser(targetUser.id, targetUser.username);

        let color;
        const db = require('../../utils/database');

        if (action === 'give') {
            color = '#2ECC71'; // Green
            db.prepare(`UPDATE wallets SET ${destination} = ${destination} + ? WHERE user_id = ? AND currency = ?`)
                .run(amount, targetUser.id, currency);

        } else if (action === 'remove') {
            color = '#E74C3C'; // Red
            db.prepare(`UPDATE wallets SET ${destination} = ${destination} - ? WHERE user_id = ? AND currency = ?`)
                .run(amount, targetUser.id, currency);

        } else if (action === 'set') {
            color = '#3498DB'; // Blue
            db.prepare(`UPDATE wallets SET ${destination} = ? WHERE user_id = ? AND currency = ?`)
                .run(amount, targetUser.id, currency);
        }

        const wallet = economyManager.getWallet(targetUser.id, currency);

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle('Economy Administration Log')
            .setDescription(`An administrative action was performed by ${interaction.user}.`)
            .addFields(
                { name: 'Action', value: `\`${action.charAt(0).toUpperCase() + action.slice(1)}\``, inline: true },
                { name: 'User', value: `${targetUser}`, inline: true },
                { name: 'Amount', value: `**${amount.toLocaleString()}** ${currency}`, inline: true },
                { name: 'Destination', value: `\`${destination === 'bank' ? 'Player Balance' : 'Sanctuary Balance'}\``, inline: false },
                { name: 'New Player Balance', value: `${wallet.bank.toLocaleString()} 🪙`, inline: false },
                { name: 'New Sanctuary Balance', value: `${wallet.balance.toLocaleString()} 🪙`, inline: false }
            )
            .setTimestamp();

        if (reason) {
            embed.addFields({ name: 'Reason', value: reason });
        }

        await interaction.editReply({ embeds: [embed] });
    },
};