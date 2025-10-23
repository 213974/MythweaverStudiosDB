// src/handlers/interactions/adminRouter.js
const economyHandler = require('./adminPanel/economyHandler');
const clanHandler = require('./adminPanel/clanHandler');
const shopHandler = require('./adminPanel/shopHandler');
const raffleHandler = require('./adminPanel/raffleHandler');
const systemsHandler = require('./adminPanel/systemsHandler');

module.exports = async (interaction) => {
    // The deferral responsibility is moved from the router to the individual handlers.
    // The router's only job is to route. This prevents deferring an already-deferred modal interaction.

    const customId = interaction.customId;
    const value = interaction.isStringSelectMenu() ? interaction.values[0] : null;

    if (customId.startsWith('admin_eco_') || value === 'admin_panel_economy') {
        await economyHandler(interaction);
    } else if (customId.startsWith('admin_clan_') || value === 'admin_panel_clans') {
        await clanHandler(interaction);
    } else if (customId.startsWith('admin_shop_') || value === 'admin_panel_shop') {
        await shopHandler(interaction);
    } else if (customId.startsWith('admin_raffle_') || value === 'admin_panel_raffles') {
        await raffleHandler(interaction);
    } else if (customId.startsWith('admin_system_') || value === 'admin_panel_systems') {
        await systemsHandler(interaction);
    } else if (customId === 'admin_panel_select' || customId === 'admin_panel_back') {
        // This is a component interaction, so it needs to be acknowledged.
        await interaction.deferUpdate();
        const { createMainDashboard } = require('../../components/adminDashboard/mainPanel');
        const response = createMainDashboard();
        await interaction.editReply({ ...response });
    }
};