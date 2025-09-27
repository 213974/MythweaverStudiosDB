// src/handlers/interactions/economyInteractionHandler.js
const claimHandler = require('./economy/claimHandler');
const navigationHandler = require('./economy/navigationHandler');
const raffleHandler = require('./economy/raffleHandler');
const leaderboardHandler = require('./economy/leaderboardHandler');

// This file is now a lean router, delegating to specialized handlers.
module.exports = async (interaction) => {
    const customId = interaction.customId;

    if (customId.startsWith('claim_')) {
        await claimHandler(interaction);
    } else if (customId.startsWith('nav_')) {
        await navigationHandler(interaction);
    } else if (customId.startsWith('raffle_')) {
        await raffleHandler(interaction);
    } else if (customId.startsWith('leaderboard_')) {
        await leaderboardHandler(interaction);
    }
};