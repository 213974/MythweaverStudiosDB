// src/managers/guildhallManager.js
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const taxManager = require('./taxManager');
const clanManager = require('./clanManager');
const { createGuildhallDashboard } = require('../components/guildhallDashboard');

// --- Helper Functions ---

/**
 * Creates or finds a guildhall channel for a specific clan using a robust, ID-based system.
 * @param {import('discord.js').Guild} guild The guild object.
 * @param {import('discord.js').Role} clanRole The clan's role object.
 * @param {string} categoryId The ID of the parent category.
 * @param {string|null} channelIdFromDb The channel ID stored in the database for this clan.
 * @returns {Promise<import('discord.js').TextChannel|null>}
 */
async function createOrFindGuildhallChannel(guild, clanRole, categoryId, channelIdFromDb) {
    // --- 1. Attempt to fetch the channel using the stored ID ---
    if (channelIdFromDb) {
        try {
            const channel = await guild.channels.fetch(channelIdFromDb);
            // Ensure permissions are up-to-date even for existing channels
            await channel.permissionOverwrites.edit(clanRole.id, { ViewChannel: true })
                .catch(e => console.error(`[GuildhallManager] Failed to update perms for ${channel.name}:`, e));
            return channel;
        } catch (error) {
            // The channel was not found (likely deleted), so we proceed to create a new one.
            console.warn(`[GuildhallManager] Could not find stored guildhall channel ${channelIdFromDb} for clan ${clanRole.name}. It will be recreated.`);
        }
    }

    // --- 2. If no ID exists or the channel was deleted, create a new one ---
    const channelName = clanRole.name.toLowerCase().replace(/\s+/g, '-');

    try {
        const newChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: categoryId,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: clanRole.id, allow: [PermissionFlagsBits.ViewChannel] },
                { id: guild.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageMessages] }
            ],
            reason: `Guildhall channel for the ${clanRole.name} clan.`,
        });

        // --- 3. CRUCIAL: Save the new channel's ID to the database ---
        clanManager.setClanGuildhallChannelId(guild.id, clanRole.id, newChannel.id);
        console.log(`[GuildhallManager] Created channel #${newChannel.name} for clan ${clanRole.name} and saved its ID.`);
        
        return newChannel;

    } catch (error) {
        console.error(`[GuildhallManager] Failed to create channel for ${clanRole.name}:`, error);
        return null;
    }
}


// --- Core Module ---

module.exports = {
    /**
     * Posts or updates the guildhall dashboard in its dedicated channel.
     * @param {import('discord.js').Client} client The Discord client.
     * @param {string} guildId The ID of the guild.
     * @param {string} clanId The ID of the clan role.
     */
    updateGuildhallDashboard: async (client, guildId, clanId) => {
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) return;

        const clanRole = await guild.roles.fetch(clanId).catch(() => null);
        if (!clanRole) {
            console.warn(`[GuildhallManager] Could not find role for clan ${clanId} during update.`);
            return;
        }
        
        const categoryId = taxManager.getGuildhallCategoryId(guildId);
        if (!categoryId) return; // Cannot proceed without a configured category

        // Fetch all data needed for the dashboard, including the channel ID
        const clanData = clanManager.getClanData(guildId, clanId);
        if (!clanData) {
            console.warn(`[GuildhallManager] Could not get clan data for ${clanId}. Aborting dashboard update.`);
            return;
        }

        const channel = await createOrFindGuildhallChannel(guild, clanRole, categoryId, clanData.guildhallChannelId);
        if (!channel) return;

        const taxStatus = taxManager.getTaxStatus(guildId, clanId);
        const taxQuota = taxManager.getTaxQuota(guildId);
        const memberCount = clanData.members.length + clanData.officers.length + clanData.viceGuildMasters.length + 1; // +1 for the owner
        
        let latestDonatorMention = null;
        if (taxStatus.last_contributor_id) {
            latestDonatorMention = `<@${taxStatus.last_contributor_id}>`;
        }

        const dashboardContent = createGuildhallDashboard(clanRole, taxStatus, taxQuota, latestDonatorMention, memberCount);

        // Find and update the existing dashboard message or send a new one
        try {
            const messages = await channel.messages.fetch({ limit: 50 });
            const botDashboard = messages.find(m => 
                m.author.id === client.user.id && 
                m.embeds[0]?.title?.includes('Guildhall')
            );
            
            if (botDashboard) {
                await botDashboard.edit(dashboardContent);
            } else {
                await channel.send(dashboardContent);
            }
        } catch (error) {
            console.error(`[GuildhallManager] Failed to send/update dashboard for ${clanRole.name}:`, error);
        }
    },

    /**
     * Synchronizes all guildhall channels, creating missing ones and updating all dashboards.
     * @param {import('discord.js').Client} client The Discord client.
     * @param {string} guildId The ID of the guild to sync.
     */
    syncAllGuildhalls: async (client, guildId) => {
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) return;

        const categoryId = taxManager.getGuildhallCategoryId(guildId);
        if (!categoryId) {
            console.log(`[GuildhallManager] Sync skipped for guild ${guildId}: No guildhall category is set.`);
            return;
        }

        const categoryChannel = await guild.channels.fetch(categoryId).catch(() => null);
        if (!categoryChannel) {
            console.warn(`[GuildhallManager] Sync failed for guild ${guildId}: Configured category ${categoryId} not found.`);
            return;
        }

        const allClans = clanManager.getAllClans(guildId);
        console.log(`[GuildhallManager] Starting sync for ${allClans.length} clans in guild ${guildId}.`);
        for (const clan of allClans) {
            await module.exports.updateGuildhallDashboard(client, guildId, clan.clan_id);
        }
    },
};