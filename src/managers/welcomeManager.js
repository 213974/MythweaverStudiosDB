// src/managers/welcomeManager.js
const { AttachmentBuilder } = require('discord.js');
const db = require('../utils/database');
const { createWelcomeBanner } = require('../../services/imageGenerator/welcomeBanner');

/**
 * Generates and sends a welcome banner for a given guild member.
 * @param {import('discord.js').GuildMember} member The member to generate the banner for.
 */
async function sendWelcomeMessage(member) {
    const { guild, user } = member;

    const welcomeChannelId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'welcome_channel_id'").get(guild.id)?.value;
    if (!welcomeChannelId) return; // Feature is not configured for this guild

    try {
        const channel = await guild.channels.fetch(welcomeChannelId);
        if (!channel) return;

        const bannerBuffer = await createWelcomeBanner(member.displayAvatarURL({ extension: 'png', size: 256 }), user.username);
        
        if (bannerBuffer) {
            const attachment = new AttachmentBuilder(bannerBuffer, { name: 'welcome-banner.jpg' });
            await channel.send({ files: [attachment] });
        }
    } catch (error) {
        console.error('[WelcomeManager] Failed to send welcome banner:', error);
    }
}

module.exports = { sendWelcomeMessage };