// events/interactionCreate.js
const { Events, Collection } = require('discord.js');
const chatInputCommandHandler = require('../handlers/chatInputCommandHandler');
const adminRouter = require('../handlers/interactions/adminRouter');
const devInteractionHandler = require('../handlers/interactions/devInteractionHandler');
const clanInteractionHandler = require('../handlers/interactions/clanInteractionHandler');
const economyInteractionHandler = require('../handlers/interactions/economyInteractionHandler');
const helpInteractionHandler = require('../handlers/interactions/helpInteractionHandler');

const SELECT_MENU_COOLDOWN_SECONDS = 5;
const BUTTON_COOLDOWN_SECONDS = 2.5;

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        try {
            if (interaction.isChatInputCommand()) {
                await chatInputCommandHandler(interaction, client);
                return;
            }

            const now = Date.now();

            // --- Dedicated cooldown for select menus ---
            if (interaction.isStringSelectMenu()) {
                const cooldowns = client.cooldowns.get('selectMenus') || new Collection();
                const userTimestamp = cooldowns.get(interaction.user.id);
                const expirationTime = userTimestamp + SELECT_MENU_COOLDOWN_SECONDS * 1000;

                if (userTimestamp && now < expirationTime) {
                    const timeLeft = (expirationTime - now) / 1000;
                    return interaction.reply({ content: `Please wait ${timeLeft.toFixed(1)} more second(s) before using a menu again.`, flags: 64 });
                }
                cooldowns.set(interaction.user.id, now);
                client.cooldowns.set('selectMenus', cooldowns);
            }

            // --- THIS IS THE FIX: Re-introduced a dedicated cooldown for buttons ---
            if (interaction.isButton()) {
                const cooldowns = client.cooldowns.get('buttons') || new Collection();
                const userTimestamp = cooldowns.get(interaction.user.id);
                const expirationTime = userTimestamp + BUTTON_COOLDOWN_SECONDS * 1000;

                if (userTimestamp && now < expirationTime) {
                    const timeLeft = (expirationTime - now) / 1000;
                    return interaction.reply({ content: `Please wait ${timeLeft.toFixed(1)} more second(s) before clicking a button again.`, flags: 64 });
                }
                cooldowns.set(interaction.user.id, now);
                client.cooldowns.set('buttons', cooldowns);
            }

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
            if (customId.startsWith('claim_') || customId.startsWith('nav_') || customId.startsWith('raffle_') || customId.startsWith('leaderboard_')) {
                await economyInteractionHandler(interaction);
                return;
            }
            if (customId.startsWith('clan_') || customId.startsWith('dashboard_')) {
                await clanInteractionHandler(interaction);
                return;
            }
            if (customId.startsWith('help_')) {
                await helpInteractionHandler(interaction);
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