// events/interactionCreate.js
const { Events, Collection } = require('discord.js');

// Import specialized handlers
const chatInputCommandHandler = require('../handlers/chatInputCommandHandler');
const adminRouter = require('../handlers/interactions/adminRouter');
const clanInteractionHandler = require('../handlers/interactions/clanInteractionHandler');
const economyInteractionHandler = require('../handlers/interactions/economyInteractionHandler');

const COMMAND_COOLDOWN_SECONDS = 2.5;

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        try {
            // --- Slash Command Handling ---
            if (interaction.isChatInputCommand()) {
                // Delegate to the dedicated chat input command handler
                await chatInputCommandHandler(interaction, client);
                return;
            }

            // Apply a brief cooldown to all components to prevent spam
            const componentCooldowns = client.cooldowns.get('components') || new Collection();
            const now = Date.now();
            const userTimestamp = componentCooldowns.get(interaction.user.id);

            if (userTimestamp) {
                const expirationTime = userTimestamp + (COMMAND_COOLDOWN_SECONDS * 1000) / 2; // Shorter cooldown for components
                if (now < expirationTime) {
                    const timeLeft = (expirationTime - now) / 1000;
                    return interaction.reply({ content: `Please wait ${timeLeft.toFixed(1)} more second(s).`, ephemeral: true });
                }
            }
            componentCooldowns.set(interaction.user.id, now);
            client.cooldowns.set('components', componentCooldowns);
            setTimeout(() => componentCooldowns.delete(interaction.user.id), (COMMAND_COOLDOWN_SECONDS * 1000) / 2);


            const customId = interaction.customId;

            // --- ROUTING TO SPECIALIZED HANDLERS ---
            if (customId.startsWith('admin_')) {
                await adminRouter(interaction);
                return;
            }

            // Route all economy-related interactions (claims, bank nav, upgrades)
            if (customId.startsWith('claim_') || customId.startsWith('nav_') || customId.startsWith('upgrade_') || customId.includes('_after_claim')) {
                await economyInteractionHandler(interaction);
                return;
            }

            // Route all clan-related interactions (dashboard, invites)
            if (customId.startsWith('clan_') || customId.startsWith('dashboard_')) {
                await clanInteractionHandler(interaction);
                return;
            }

        } catch (error) {
            console.error(`[InteractionCreate Error] An error occurred:`, error);
            const replyOptions = { content: 'An unexpected error occurred while processing your request. The developers have been notified.', ephemeral: true };
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