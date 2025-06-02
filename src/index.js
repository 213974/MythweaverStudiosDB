// src/index.js
require('dotenv').config();

const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const path = require('node:path');
const config = require('./config');
console.log('[index.js] Loaded config:', JSON.stringify(config));
const loadEvents = require('../handlers/eventHandler'); // Ensure this path is correct for your structure

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message],
});

client.lastPandaMentionResponse = 0; // Timestamp of the last PandaYay response, 0 means ready

client.commands = new Collection();
loadEvents(client, config);

const token = process.env.DISCORD_TOKEN;
if (!token) {
    console.error("Error: DISCORD_TOKEN is not defined in your .env file!");
    process.exit(1);
}

client.login(token)
    .then(() => {
        // Login success is handled in ready.js
    })
    .catch(error => {
        console.error("Failed to log in:", error);
        if (error.code === 'DisallowedIntents') {
            console.error("Please ensure all Privileged Gateway Intents are enabled for your bot.");
        }
    });

process.on('SIGINT', () => {
    console.log("Shutting down bot...");
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log("Shutting down bot...");
    client.destroy();
    process.exit(0);
});