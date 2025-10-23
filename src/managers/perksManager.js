// src/managers/perksManager.js
const db = require('../utils/database');

async function isEligibleForPerks(member) {
    if (!member) return false;

    if (member.premiumSinceTimestamp) {
        return true;
    }

    const boosterRoleId = db.prepare("SELECT value FROM settings WHERE guild_id = ? AND key = 'booster_role_id'").get(member.guild.id)?.value;
    if (boosterRoleId && member.roles.cache.has(boosterRoleId)) {
        return true;
    }

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