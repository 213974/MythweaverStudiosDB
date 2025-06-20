// src/handlers/eventHandler.js
const fs = require('node:fs');
const path = require('node:path');

module.exports = (client, config) => {
    const eventsPath = path.join(__dirname, '..', 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client, config));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client, config));
        }
        console.log(`[EVENT HANDLER] Loaded event: ${event.name}`);
    }
};