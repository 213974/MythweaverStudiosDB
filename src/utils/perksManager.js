// src/utils/perksManager.js
const db = require('./database');

async function isEligibleForPerks(member) {
    if (!member) return false;

    // 1. Check for native server boosting
    if (member.premiumSinceTimestamp) {
        return true;
    }

    // 2. Check for the configured booster role
    const boosterRoleId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'booster_role_id'").get(member.guild.id)?.value;
    if (boosterRoleId && member.roles.cache.has(boosterRoleId)) {
        return true;
    }

    // 3. Check the manual whitelist in the database
    const manualBooster = db.prepare("SELECT user_id FROM manual_boosters WHERE guild_id = ? AND user_id = ?").get(member.guild.id, member.id);
    if (manualBooster) {
        return true;
    }

    return false;
}

function getBoosterPerk(guildId, userId) {
    return db.prepare("SELECT emoji FROM booster_perks WHERE guild_id = ? AND user_id = ?").get(guildId, userId);
}

module.exports = { isEligibleForPerks, getBoosterPerk };