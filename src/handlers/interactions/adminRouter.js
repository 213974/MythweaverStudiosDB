// src/handlers/interactions/adminRouter.js
const economyHandler = require('./adminPanel/economyHandler');
const clanHandler = require('./adminPanel/clanHandler');
const shopHandler = require('./adminPanel/shopHandler');
const raffleHandler = require('./adminPanel/raffleHandler');

module.exports = async (interaction) => {
    const customId = interaction.customId;

    if (customId.startsWith('admin_eco_') || interaction.values?.[0] === 'admin_panel_economy') {
        await economyHandler(interaction);
    } else if (customId.startsWith('admin_clan_') || interaction.values?.[0] === 'admin_panel_clans') {
        await clanHandler(interaction);
    } else if (customId.startsWith('admin_shop_') || interaction.values?.[0] === 'admin_panel_shop') {
        await shopHandler(interaction);
    } else if (customId.startsWith('admin_raffle_') || interaction.values?.[0] === 'admin_panel_raffles') {
        await raffleHandler(interaction);
    } else if (customId === 'admin_panel_select' || customId === 'admin_panel_back') {
        const { createMainDashboard } = require('../../components/adminDashboard/mainPanel');
        const response = createMainDashboard();
        await interaction.update({ ...response });
    }
};