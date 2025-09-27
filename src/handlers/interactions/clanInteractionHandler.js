// src/handlers/interactions/clanInteractionHandler.js
const dashboardHandler = require('./clan/dashboardHandler');
const inviteResponseHandler = require('./clan/inviteResponseHandler');
const mottoModalHandler = require('./clan/mottoModalHandler');

// This file is now a lean router.
module.exports = async (interaction) => {
    const customId = interaction.customId;

    // Route to the main dashboard logic (select menus, workflow starters)
    if (customId.startsWith('dashboard_')) {
        await dashboardHandler(interaction);
    }
    // Route to the handler for invitation button presses (accept/deny)
    else if (customId.startsWith('clan_')) {
        await inviteResponseHandler(interaction);
    }
    // Route to the handler for the motto modal submission
    else if (customId.startsWith('motto_modal')) { // Note: This was a typo in the plan, corrected to match the modal's ID
        await mottoModalHandler(interaction);
    }
};