// events/messageCreate.js
const { Events } = require('discord.js');

const PANDA_YAY_EMOJI = '<:PandaYay:1357806568535490812>';
const COOLDOWN_DURATION = 2500; // 2.5 seconds in milliseconds

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client, config) { // client and config are passed from your eventHandler
        // Ignore messages from bots
        if (message.author.bot) {
            return;
        }

        // Check if the bot was mentioned
        const botMentioned = message.mentions.has(client.user) ||
            message.content.includes(`<@${client.user.id}>`) ||
            message.content.includes(`<@!${client.user.id}>`);

        if (botMentioned) {
            const now = Date.now();

            // Check global cooldown for PandaYay response
            // client.lastPandaMentionResponse is initialized in src/index.js
            if (now - client.lastPandaMentionResponse < COOLDOWN_DURATION) {
                // Still on cooldown
                // console.log(`PandaYay mention response is on cooldown. Time left: ${((client.lastPandaMentionResponse + COOLDOWN_DURATION) - now) / 1000}s`);
                return;
            }

            try {
                await message.channel.send(PANDA_YAY_EMOJI);
                client.lastPandaMentionResponse = now; // Update the timestamp after sending
            } catch (error) {
                console.error(`Failed to send PandaYay emoji in channel ${message.channel.id}:`, error);
                // Consider if you want to reset the cooldown here or let it be,
                // as the action wasn't successful. For now, it doesn't reset on failure.
            }
        }
    },
};