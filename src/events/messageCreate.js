// src/events/messageCreate.js
const { Events, MessageType } = require('discord.js');
const config = require('../config');
const db = require('../utils/database');
const { updateAnalyticsDashboard } = require('../utils/scheduler');
const { sendOrUpdateDashboard } = require('../utils/dashboardManager');
const { sendOrUpdateLeaderboard } = require('../utils/leaderboardManager');
const economyManager = require('../utils/economyManager');
const { isEligibleForPerks, getBoosterPerk } = require('../utils/perksManager');

const PANDA_YAY_EMOJI = '<:PandaYay:1357806568535490812>';
const MENTION_COOLDOWN_DURATION = 2500;
const EVENT_COOLDOWN_SECONDS = 10;
const BOOSTER_REACTION_COOLDOWN_SECONDS = 5;

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        const guildId = message.guild.id;

        // --- Dev Owner Manual Whitelist Logic ---
        if (config.ownerIDs.includes(message.author.id) && message.mentions.has(client.user.id) && message.mentions.users.size === 2) {
            const targetUser = message.mentions.users.find(u => u.id !== client.user.id);
            if (targetUser) {
                db.prepare(`INSERT OR IGNORE INTO manual_boosters (guild_id, user_id) VALUES (?, ?)`).run(guildId, targetUser.id);
                await message.react('✅').catch(err => console.error('[Whitelist] Failed to react to whitelist message:', err));
                return; // Stop further processing for this command-like message
            }
        }

        // --- Booster Auto-Reaction Logic ---
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

        // --- Event "Solyx per Message" Logic ---
        const activeEvent = client.activeEvents.get(guildId);
        if (activeEvent && activeEvent.type === 'message') {
            const now = Date.now();
            const endTimestampMs = activeEvent.endTimestamp * 1000;

            if (now > endTimestampMs) {
                client.activeEvents.delete(guildId);
            } else {
                const cooldownKey = `${guildId}-${message.author.id}`;
                const userCooldown = client.eventCooldowns.get(cooldownKey);
                
                if (!userCooldown || now > userCooldown) {
                    economyManager.addEventBalance(message.author.id, guildId, activeEvent.reward);
                    client.eventCooldowns.set(cooldownKey, now + EVENT_COOLDOWN_SECONDS * 1000);
                }
            }
        }

        // --- Persistent Help Dashboard Logic ---
        const helpChannelId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'help_dashboard_channel_id'").get(guildId)?.value;
        if (message.channel.id === helpChannelId) {
            clearTimeout(client.helpDashboardTimeout);
            client.helpDashboardTimeout = setTimeout(async () => {
                try {
                    const messageId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'help_dashboard_message_id'").get(guildId)?.value;
                    if (messageId) {
                        const oldMessage = await message.channel.messages.fetch(messageId).catch(() => null);
                        if (oldMessage) await oldMessage.delete().catch(() => {});
                    }
                    
                    const { createHelpDashboard } = require('../commands/help');
                    const dashboard = createHelpDashboard();
                    const newMessage = await message.channel.send(dashboard);
                    db.prepare("INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, 'help_dashboard_message_id', ?)").run(guildId, newMessage.id);
                } catch (error) {
                    console.error('[HelpDashboard] Failed to re-post help dashboard:', error);
                }
            }, 30000);
        }

        // --- Bot Mention Response ---
        const isReplyToBot = message.type === MessageType.Reply && message.mentions.repliedUser?.id === client.user.id;
        const isDirectMention = message.mentions.has(client.user.id) && !message.mentions.everyone && message.mentions.users.size === 1;

        if (isDirectMention && !isReplyToBot) {
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