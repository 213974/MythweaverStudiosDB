// src/index.js
require('dotenv').config();

const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const path = require('node:path');
const config = require('./config');
console.log('[index.js] Loaded config:', JSON.stringify(config));
const loadEvents = require('../handlers/eventHandler');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers, // Needed to fetch members for role assignment
    ],
    partials: [Partials.Channel, Partials.Message],
});

client.lastPandaMentionResponse = 0;
client.commands = new Collection(); // Initialize commands collection

loadEvents(client, config); // This loads event files like ready.js, messageCreate.js etc.

const token = process.env.DISCORD_TOKEN;
if (!token) {
    console.error("Error: DISCORD_TOKEN is not defined in your .env file!");
    process.exit(1);
}

client.login(token)
    .catch(error => {
        console.error("Failed to log in:", error);
        if (error.code === 'DisallowedIntents') {
            console.error("Please ensure all Privileged Gateway Intents (especially Server Members Intent) are enabled for your bot in the Discord Developer Portal.");
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