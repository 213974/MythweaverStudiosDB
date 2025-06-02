// events/interactionCreate.js
const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client, config) {
        // This event will fire for slash commands, buttons, etc.
        // Add your interaction handling logic here later.
        // For now, you can leave it empty or add a log:
        // if (!interaction.isChatInputCommand()) return;
        // console.log(`Received interaction: ${interaction.commandName}`);
    },
};