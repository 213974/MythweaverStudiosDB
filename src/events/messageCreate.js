// events/messageCreate.js
const { Events, MessageType } = require('discord.js'); // Added MessageType

const PANDA_YAY_EMOJI = '<:PandaYay:1357806568535490812>';
const COOLDOWN_DURATION = 2500; // 2.5 seconds in milliseconds

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client, config) {
        // Ignore messages from other bots entirely
        if (message.author.bot) {
            return;
        }

        // Check if the message is a reply to this bot's own message
        // If it is, and there isn't an *additional* explicit mention of this bot in the content, ignore it.
        if (message.type === MessageType.Reply && message.mentions.repliedUser && message.mentions.repliedUser.id === client.user.id) {
            // Check if the bot is ALSO explicitly mentioned in the content of the reply,
            // beyond just the reply ping itself.
            const contentMentionsThisBot = message.content.includes(`<@${client.user.id}>`) || message.content.includes(`<@!${client.user.id}>`);
            if (!contentMentionsThisBot) {
                // It's just a reply to the bot, without a new explicit mention.
                return;
            }
            // If it IS a reply AND has an explicit mention in the content, proceed.
        }


        // Check if this bot was specifically mentioned
        // 1. Direct mention in the mentions collection
        // 2. Content includes <@BOT_ID> or <@!BOT_ID> (the exclamation mark is for nicknames)
        const specificBotMentioned =
            message.mentions.has(client.user.id) || // Check by ID for more specificity than `client.user` object
            message.content.includes(`<@${client.user.id}>`) ||
            message.content.includes(`<@!${client.user.id}>`);


        if (specificBotMentioned) {
            const now = Date.now();

            if (now - client.lastPandaMentionResponse < COOLDOWN_DURATION) {
                // console.log(`PandaYay mention response is on cooldown.`);
                return;
            }

            try {
                await message.channel.send(PANDA_YAY_EMOJI);
                client.lastPandaMentionResponse = now;
            } catch (error) {
                console.error(`Failed to send PandaYay emoji in channel ${message.channel.id}:`, error);
            }
        }
    },
};