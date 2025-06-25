// commands/admin/admin-eco.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const economyManager = require('../../utils/economyManager');
const config = require('../../src/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin-eco')
        .setDescription('Manage user economy.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName('give')
                .setDescription('Gives currency to a user.')
                .addStringOption(option => option.setName('currency').setDescription('The currency to give.').setRequired(true).addChoices({ name: 'Gold', value: 'Gold' }))
                .addUserOption(option => option.setName('user').setDescription('The user to give currency to.').setRequired(true))
                .addIntegerOption(option => option.setName('amount').setDescription('The amount to give.').setRequired(true).setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand.setName('remove')
                .setDescription('Removes currency from a user.')
                .addStringOption(option => option.setName('currency').setDescription('The currency to remove.').setRequired(true).addChoices({ name: 'Gold', value: 'Gold' }))
                .addUserOption(option => option.setName('user').setDescription('The user to remove currency from.').setRequired(true))
                .addIntegerOption(option => option.setName('amount').setDescription('The amount to remove.').setRequired(true).setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand.setName('set')
                .setDescription('Sets a user\'s currency balance.')
                .addStringOption(option => option.setName('currency').setDescription('The currency to set.').setRequired(true).addChoices({ name: 'Gold', value: 'Gold' }))
                .addUserOption(option => option.setName('user').setDescription('The user whose balance to set.').setRequired(true))
                .addIntegerOption(option => option.setName('amount').setDescription('The exact balance to set.').setRequired(true).setMinValue(0))),

    async execute(interaction) {
        if (interaction.user.id !== config.ownerID && !interaction.member.roles.cache.has(config.serverAdminRoleID)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: 64 });
        }

        const subcommand = interaction.options.getSubcommand();
        const currency = interaction.options.getString('currency');
        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        economyManager.ensureUser(targetUser.id, targetUser.username);

        let wallet;
        if (subcommand === 'give') {
            economyManager.updateBalance(targetUser.id, amount, currency);
            wallet = economyManager.getWallet(targetUser.id, currency);
            await interaction.reply({ content: `Gave **${amount.toLocaleString()}** ${currency} to ${targetUser.username}. Their new balance is ${wallet.balance.toLocaleString()}.`, flags: 64 });
        } else if (subcommand === 'remove') {
            economyManager.updateBalance(targetUser.id, -amount, currency);
            wallet = economyManager.getWallet(targetUser.id, currency);
            await interaction.reply({ content: `Removed **${amount.toLocaleString()}** ${currency} from ${targetUser.username}. Their new balance is ${wallet.balance.toLocaleString()}.`, flags: 64 });
        } else if (subcommand === 'set') {
            economyManager.setBalance(targetUser.id, amount, currency);
            await interaction.reply({ content: `Set ${targetUser.username}'s ${currency} balance to **${amount.toLocaleString()}**.`, flags: 64 });
        }
    },
};