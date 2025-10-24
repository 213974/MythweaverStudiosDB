// src/events/messageCreate.js
const { Events, MessageType, Collection } = require('discord.js');
const config = require('../config');
const db = require('../utils/database');
const { isEligibleForPerks, getBoosterPerk } = require('../managers/perksManager');
const economyManager = require('../managers/economyManager');
const userManager = require('../managers/userManager');
const { getSettings } = require('../utils/settingsCache');
const { sendWelcomeMessage } = require('../managers/welcomeManager');
const { sendOrUpdateQuickActions } = require('../managers/quickActionsManager');
const { sendOrUpdateHelpDashboard } = require('../managers/helpDashboardManager');

// --- Constants ---
const PANDA_YAY_EMOJI = '<:PandaYay:1357806568535490812>';
const MENTION_COOLDOWN_DURATION = 2500;
const BOOSTER_REACTION_COOLDOWN_SECONDS = 5;
const SOLYX_PER_MESSAGE_COOLDOWN_SECONDS = 60; // 1 minute cooldown per user
// Regex to find a custom emoji or a standard Unicode emoji in a string.
const EMOJI_REGEX = /(<a?:\w+:\d{17,19}>|[\u{1F300}-\u{1F6FF}\u{2600}-\u{26FF}])/u;

const messageSolyxCooldowns = new Collection();

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (!message.guild) return;

        const guildId = message.guild.id;

        // --- This block now runs for ALL messages, including the bot's own. ---
        const quickActionsChannelId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'quick_actions_channel_id'").get(guildId)?.value;
        if (message.channel.id === quickActionsChannelId && message.author.id !== client.user.id) { // Only trigger on non-bot messages to prevent loops
            clearTimeout(client.quickActionsTimeout);
            client.quickActionsTimeout = setTimeout(() => {
                sendOrUpdateQuickActions(client, guildId);
            }, 30000); // 30 seconds
        }

        // --- All logic below this point should ignore bots. ---
        if (message.author.bot) return;

        // --- Owner-only welcome message test ---
        const welcomeChannelId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'welcome_channel_id'").get(guildId)?.value;
        if (message.channel.id === welcomeChannelId && 
            config.ownerIDs.includes(message.author.id) &&
            message.mentions.has(client.user.id) && 
            message.mentions.users.size === 1) {
                console.log(`[Welcome] Owner ${message.author.tag} triggered a test welcome banner.`);
                await sendWelcomeMessage(message.member);
                return;
        }

        // --- Help dashboard auto-repost logic ---
        const helpChannelId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'help_dashboard_channel_id'").get(guildId)?.value;
        if (message.channel.id === helpChannelId) {
            clearTimeout(client.helpDashboardTimeout);
            client.helpDashboardTimeout = setTimeout(() => {
                sendOrUpdateHelpDashboard(client, guildId);
            }, 30000);
        }

        // --- Solyx per Message System ---
        const settings = getSettings(guildId);
        if (settings.get('system_solyx_text_enabled') === 'true') {
            const now = Date.now();
            const userCooldown = messageSolyxCooldowns.get(message.author.id);

            if (!userCooldown || now > userCooldown) {
                const rate = parseFloat(settings.get('system_solyx_text_rate') || '0.1');
                if (rate > 0) {
                    economyManager.modifySolyx(message.author.id, guildId, rate, 'Message Activity');
                    userManager.addSolyxFromSource(message.author.id, guildId, rate, 'message');
                }
                messageSolyxCooldowns.set(message.author.id, now + SOLYX_PER_MESSAGE_COOLDOWN_SECONDS * 1000);
            }
        }

        // --- Owner-only Manual Booster Whitelist ---
        if (config.ownerIDs.includes(message.author.id) && message.mentions.has(client.user.id) && message.mentions.users.size === 2) {
            const targetUser = message.mentions.users.find(u => u.id !== client.user.id);
            if (targetUser) {
                db.prepare(`INSERT OR IGNORE INTO manual_boosters (guild_id, user_id) VALUES (?, ?)`).run(guildId, targetUser.id);
                await message.react('✅').catch(err => console.error('[Whitelist] Failed to react to whitelist message:', err));
                return;
            }
        }

        // --- Booster Auto-Reaction on Message Send ---
        try {
            const member = message.member || await message.guild.members.fetch(message.author.id);
            const isEligible = await isEligibleForPerks(member);

            if (isEligible) {
                const perk = getBoosterPerk(guildId, message.author.id);
                if (perk) {
                    const now = Date.now();
                    const userCooldown = client.boosterCooldowns.get(message.author.id);
                    if (!userCooldown || now > userCooldown) {
                        await message.react(perk.emoji).catch(err => console.error(`[BoosterPerk] Failed to react with emoji: ${perk.emoji}`, err));
                        client.boosterCooldowns.set(message.author.id, now + BOOSTER_REACTION_COOLDOWN_SECONDS * 1000);
                    }
                }
            }
        } catch (error) {
            console.error('[BoosterPerk] Error checking for booster perks:', error);
        }
        
        // --- Mention Handlers ---
        const isReplyToBot = message.type === MessageType.Reply && message.mentions.repliedUser?.id === client.user.id;
        const emojiMatch = message.content.match(EMOJI_REGEX);
        
        // --- NEW: Self-Mention to Set Perk ---
        const isSelfMention = message.mentions.has(message.author.id) && !message.mentions.everyone && message.mentions.users.size === 1;
        if (isSelfMention && emojiMatch && !isReplyToBot) {
            try {
                const member = message.member || await message.guild.members.fetch(message.author.id);
                if (await isEligibleForPerks(member)) {
                    const emojiString = emojiMatch[0];
                    const customEmojiMatch = emojiString.match(/<a?:\w+:(\d{17,19})>/);
                    const emojiIdentifier = customEmojiMatch ? customEmojiMatch[1] : emojiString;

                    db.prepare(`INSERT OR REPLACE INTO booster_perks (guild_id, user_id, emoji) VALUES (?, ?, ?)`).run(guildId, message.author.id, emojiIdentifier);
                    await message.react('✅');
                    return; // Perk was set, do not proceed to other mention handlers.
                }
            } catch (error) {
                console.error('[BoosterPerkSet] Failed to set perk via self-mention:', error);
            }
        }

        // --- Bot Mention Handler ---
        const isDirectMention = message.mentions.has(client.user.id) && !message.mentions.everyone && message.mentions.users.size === 1;
        if (isDirectMention && !isReplyToBot) {
            // --- Text-based Booster Perk Setting (mentioning the bot) ---
            if (emojiMatch) {
                try {
                    const member = message.member || await message.guild.members.fetch(message.author.id);
                    if (await isEligibleForPerks(member)) {
                        const emojiString = emojiMatch[0];
                        const customEmojiMatch = emojiString.match(/<a?:\w+:(\d{17,19})>/);
                        const emojiIdentifier = customEmojiMatch ? customEmojiMatch[1] : emojiString;

                        db.prepare(`INSERT OR REPLACE INTO booster_perks (guild_id, user_id, emoji) VALUES (?, ?, ?)`).run(guildId, message.author.id, emojiIdentifier);
                        await message.react('✅');
                        return; // Perk was set, do not proceed to Panda response.
                    }
                } catch (error) {
                    console.error('[BoosterPerkSet] Failed to set perk via bot-mention:', error);
                }
            }

            // --- Fallback: Generic Panda Response ---
            const now = Date.now();
            if (now - (client.lastPandaMentionResponse || 0) > MENTION_COOLDOWN_DURATION) {
                try {
                    await message.channel.send(PANDA_YAY_EMOJI);
                    client.lastPandaMentionResponse = now;
                } catch (error) {
                    console.error(`Failed to send PandaYay emoji:`, error);
                }
            }
        }
    },
};