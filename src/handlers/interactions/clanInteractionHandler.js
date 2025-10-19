// src/handlers/interactions/clanInteractionHandler.js
const dashboardHandler = require('./clan/dashboardHandler');
const inviteResponseHandler = require('./clan/inviteResponseHandler');
const mottoModalHandler = require('./clan/mottoModalHandler');

// This file is now a lean router.
module.exports = async (interaction) => {
    const customId = interaction.customId;

    // --- THIS IS THE FIX ---
    // The router now correctly identifies the select menu's custom ID ('clan_dashboard_menu')
    // and routes it to the correct handler ('dashboardHandler').
    if (customId === 'clan_dashboard_menu' || customId.startsWith('dashboard_')) {
        await dashboardHandler(interaction);
    }
    // Route to the handler for invitation button presses (accept/deny)
    else if (customId.startsWith('clan_')) {
        await inviteResponseHandler(interaction);
    }
    // Route to the handler for the motto modal submission
    else if (customId.startsWith('motto_modal')) {
        await mottoModalHandler(interaction);
    }
};