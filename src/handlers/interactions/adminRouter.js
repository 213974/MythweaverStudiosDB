// src/handlers/interactions/adminRouter.js
const economyHandler = require('./adminPanel/economyHandler');
const clanHandler = require('./adminPanel/clanHandler');
const shopHandler = require('./adminPanel/shopHandler');
const raffleHandler = require('./adminPanel/raffleHandler');
const eventHandler = require('./adminPanel/eventHandler'); // Import the new handler

module.exports = async (interaction) => {
    const customId = interaction.customId;
    // Get the select menu value if it exists
    const value = interaction.isStringSelectMenu() ? interaction.values[0] : null;

    if (customId.startsWith('admin_eco_') || value === 'admin_panel_economy') {
        await economyHandler(interaction);
    } else if (customId.startsWith('admin_clan_') || value === 'admin_panel_clans') {
        await clanHandler(interaction);
    } else if (customId.startsWith('admin_shop_') || value === 'admin_panel_shop') {
        await shopHandler(interaction);
    } else if (customId.startsWith('admin_raffle_') || value === 'admin_panel_raffles') {
        await raffleHandler(interaction);
    } else if (customId.startsWith('admin_event_') || value === 'admin_panel_events') {
        // This logic handles both the initial select menu and subsequent interactions
        if (value === 'admin_panel_events') {
            const { createEventDashboard } = require('../../components/adminDashboard/eventPanel');
            const response = createEventDashboard(interaction.guild.id);
            // Use reply for the initial menu selection
            return interaction.reply({ ...response, flags: 64 });
        }
        // Delegate button/modal interactions to the handler
        await eventHandler(interaction);
    } else if (customId === 'admin_panel_select' || customId === 'admin_panel_back') {
        const { createMainDashboard } = require('../../components/adminDashboard/mainPanel');
        const response = createMainDashboard();
        await interaction.update({ ...response });
    }
};