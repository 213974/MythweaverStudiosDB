// src/utils/settingsCache.js
const db = require('./database');

// In-memory cache for system settings
const systemSettingsCache = new Map();

/**
 * Retrieves all system settings for a guild, using a cache to reduce database queries.
 * @param {string} guildId The ID of the guild to fetch settings for.
 * @returns {Map<string, string>} A map of the guild's system settings.
 */
function getSettings(guildId) {
    if (systemSettingsCache.has(guildId)) {
        return systemSettingsCache.get(guildId);
    }

    // If not in cache, fetch from DB
    const settingsRaw = db.prepare("SELECT key, value FROM settings WHERE guild_id = ? AND key LIKE 'system_solyx_%'").all(guildId);
    const settings = new Map(settingsRaw.map(s => [s.key, s.value]));
    
    // Store in cache
    systemSettingsCache.set(guildId, settings);
    
    console.log(`[Cache] Stored settings for guild ${guildId}.`);
    return settings;
}

/**
 * Immediately removes a guild's settings from the cache, forcing a refresh on the next request.
 * @param {string} guildId The ID of the guild whose cache should be invalidated.
 */
function invalidateCache(guildId) {
    systemSettingsCache.delete(guildId);
    console.log(`[Cache] Invalidated settings for guild ${guildId}.`);
}

module.exports = {
    getSettings,
    invalidateCache
};