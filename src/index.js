// src/index.js
require('dotenv').config();

const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
// const path = require('node:path');
const config = require('./config');
console.log('[index.js] Loaded config:', JSON.stringify(config));
const loadEvents = require('./handlers/eventHandler');
const { startScheduler } = require('./utils/scheduler');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates, // --- NEW INTENT ---
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction,], 
});

client.lastPandaMentionResponse = 0;
client.commands = new Collection(); // Initialize commands collection
client.cooldowns = new Collection(); // For user-based cooldowns on interactions
client.raffleUpdateQueue = new Set();
client.eventCooldowns = new Collection();
client.helpDashboardTimeout = null;
client.boosterCooldowns = new Collection();
client.activeVcSessions = new Collection();

loadEvents(client, config); // This loads event files like ready.js, messageCreate.js etc.

// Start the background task scheduler
startScheduler(client);

const token = process.env.DISCORD_TOKEN;
if (!token) {
    console.error("Error: DISCORD_TOKEN is not defined in your .env file!");
    process.exit(1);
}

client.login(token)
    .catch(error => {
        console.error("Failed to log in:", error);
        if (error.code === 'DisallowedIntents') {
            console.error("Please ensure all Privileged Gateway Intents (especially Server Members and Voice States Intent) are enabled for your bot in the Discord Developer Portal.");
        }
    });

// Graceful shutdown
process.on('SIGINT', () => {
    console.log("Shutting down bot (SIGINT)...");
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log("Shutting down bot (SIGTERM)...");
    client.destroy();
    process.exit(0);
});