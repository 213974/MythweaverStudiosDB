// commands/admin/adminShop.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const economyManager = require('../../utils/economyManager');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin-shop')
        .setDescription('Manage the role shop.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName('add')
                .setDescription('Adds a role to the shop.')
                .addRoleOption(option => option.setName('role').setDescription('The role to add.').setRequired(true))
                .addIntegerOption(option => option.setName('price').setDescription('The price of the role.').setRequired(true).setMinValue(0))
                .addStringOption(option => option.setName('description').setDescription('A description for the shop item.').setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('remove')
                .setDescription('Removes a role from the shop.')
                .addRoleOption(option => option.setName('role').setDescription('The role to remove.').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('update')
                .setDescription('Updates the price of a role in the shop.')
                .addRoleOption(option => option.setName('role').setDescription('The role to update.').setRequired(true))
                .addIntegerOption(option => option.setName('price').setDescription('The new price.').setRequired(true).setMinValue(0))),

    async execute(interaction) {
        if (interaction.user.id !== config.ownerID && !interaction.member.roles.cache.has(config.serverAdminRoleID)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: 64 });
        }

        const subcommand = interaction.options.getSubcommand();
        const role = interaction.options.getRole('role');

        if (subcommand === 'add') {
            const price = interaction.options.getInteger('price');
            const description = interaction.options.getString('description');
            const result = economyManager.addShopItem(role.id, price, role.name, description);
            if (result.success) {
                await interaction.reply({ content: `Successfully added the **${role.name}** role to the shop for **${price.toLocaleString()}** 🪙.`, flags: 64 });
            } else {
                await interaction.reply({ content: `Failed to add item: ${result.message}`, flags: 64 });
            }
        } else if (subcommand === 'remove') {
            const result = economyManager.removeShopItem(role.id);
            if (result.success) {
                await interaction.reply({ content: `Successfully removed the **${role.name}** role from the shop.`, flags: 64 });
            } else {
                await interaction.reply({ content: `Failed to remove item: It may not be in the shop.`, flags: 64 });
            }
        } else if (subcommand === 'update') {
            const price = interaction.options.getInteger('price');
            const result = economyManager.updateShopItem(role.id, price);
            if (result.success) {
                await interaction.reply({ content: `Successfully updated the price of **${role.name}** to **${price.toLocaleString()}** 🪙.`, flags: 64 });
            } else {
                await interaction.reply({ content: `Failed to update item: It may not be in the shop.`, flags: 64 });
            }
        }
    },
};