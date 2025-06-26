// commands/admin/adminEconomy.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const economyManager = require('../../utils/economyManager');
const config = require('../../src/config');

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
                .setMinValue(0)),

    async execute(interaction) {
        if (interaction.user.id !== config.ownerID && !interaction.member.roles.cache.has(config.serverAdminRoleID)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: 64 });
        }

        const action = interaction.options.getString('action');
        const currency = interaction.options.getString('currency');
        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        economyManager.ensureUser(targetUser.id, targetUser.username);

        let wallet;
        if (action === 'give') {
            economyManager.updateBalance(targetUser.id, amount, currency);
            wallet = economyManager.getWallet(targetUser.id, currency);
            await interaction.reply({ content: `Gave **${amount.toLocaleString()}** ${currency} to ${targetUser.username}. Their new balance is ${wallet.balance.toLocaleString()}.`, flags: 64 });
        } else if (action === 'remove') {
            economyManager.updateBalance(targetUser.id, -amount, currency);
            wallet = economyManager.getWallet(targetUser.id, currency);
            await interaction.reply({ content: `Removed **${amount.toLocaleString()}** ${currency} from ${targetUser.username}. Their new balance is ${wallet.balance.toLocaleString()}.`, flags: 64 });
        } else if (action === 'set') {
            economyManager.setBalance(targetUser.id, amount, currency);
            await interaction.reply({ content: `Set ${targetUser.username}'s ${currency} balance to **${amount.toLocaleString()}**.`, flags: 64 });
        }
    },
};