// events/interactionCreate.js
const { Events, Collection } = require('discord.js');

// Import specialized handlers
const chatInputCommandHandler = require('../handlers/chatInputCommandHandler');
const adminRouter = require('../handlers/interactions/adminRouter');
const devInteractionHandler = require('../handlers/interactions/devInteractionHandler');
const clanInteractionHandler = require('../handlers/interactions/clanInteractionHandler');
const economyInteractionHandler = require('../handlers/interactions/economyInteractionHandler');

const COMMAND_COOLDOWN_SECONDS = 2.5;

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        try {
            // --- Slash Command Handling ---
            if (interaction.isChatInputCommand()) {
                await chatInputCommandHandler(interaction, client);
                return;
            }

            // Apply a brief cooldown to all components
            const componentCooldowns = client.cooldowns.get('components') || new Collection();
            const now = Date.now();
            const userTimestamp = componentCooldowns.get(interaction.user.id);

            if (userTimestamp) {
                const expirationTime = userTimestamp + 1250; // 1.25 second cooldown
                if (now < expirationTime) {
                    const timeLeft = (expirationTime - now) / 1000;
                    return interaction.reply({ content: `Please wait ${timeLeft.toFixed(1)} more second(s).`, flags: 64 });
                }
            }
            componentCooldowns.set(interaction.user.id, now);
            client.cooldowns.set('components', componentCooldowns);
            setTimeout(() => componentCooldowns.delete(interaction.user.id), 1250);

            const customId = interaction.customId;

            // --- ROUTING TO SPECIALIZED HANDLERS ---
            if (customId.startsWith('admin_')) {
                await adminRouter(interaction);
                return;
            }

            if (customId.startsWith('settings_')) {
                await devInteractionHandler(interaction);
                return;
            }

            if (customId.startsWith('claim_') || customId.startsWith('nav_') || customId.startsWith('raffle_')) {
                await economyInteractionHandler(interaction);
                return;
            }

            if (customId.startsWith('clan_') || customId.startsWith('dashboard_')) {
                await clanInteractionHandler(interaction);
                return;
            }

        } catch (error) {
            console.error(`[InteractionCreate Error] An error occurred:`, error);
            const replyOptions = { content: 'An unexpected error occurred while processing your request.', flags: 64 };
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(replyOptions);
                } else {
                    await interaction.reply(replyOptions);
                }
            } catch (followUpError) {
                console.error(`[InteractionCreate Error] Failed to send error feedback to user:`, followUpError);
            }
        }
    },
};