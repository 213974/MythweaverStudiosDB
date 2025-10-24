// src/helpers/interactionHelpers.js

/**
 * Robustly parses user input to find a guild member.
 * Handles mentions, IDs, and usernames.
 * @param {import('discord.js').Guild} guild The guild to search in.
 * @param {string} userInput The raw input from the user.
 * @returns {Promise<import('discord.js').GuildMember|null>}
 */
async function parseUser(guild, userInput) {
    if (!userInput) return null;
    const trimmedInput = userInput.trim();

    // 1. Try parsing as a mention or raw ID
    const mentionOrIdMatch = trimmedInput.match(/^(?:<@!?)?(\d{17,19})>?$/);
    if (mentionOrIdMatch) {
        try {
            const member = await guild.members.fetch(mentionOrIdMatch[1]);
            if (member) return member;
        } catch (error) {
            // Ignore fetch errors (user not in guild), proceed to name search
        }
    }

    // 2. Fallback to searching by username
    try {
        const members = await guild.members.search({ query: trimmedInput, limit: 1 });
        return members.first() || null;
    } catch (error) {
        console.error(`[parseUser] Failed to search for member "${trimmedInput}":`, error);
        return null;
    }
}

/**
 * Robustly parses role input to find a guild role.
 * Handles mentions, IDs, and role names.
 * @param {import('discord.js').Guild} guild The guild to search in.
 * @param {string} roleInput The raw input from the user.
 * @returns {Promise<import('discord.js').Role|null>}
 */
async function parseRole(guild, roleInput) {
    if (!roleInput) return null;
    const trimmedInput = roleInput.trim();

    // 1. Try parsing as a mention or raw ID
    const mentionOrIdMatch = trimmedInput.match(/^(?:<@&)?(\d{17,19})>?$/);
    if (mentionOrIdMatch) {
        try {
            const role = await guild.roles.fetch(mentionOrIdMatch[1]);
            if (role) return role;
        } catch (error) {
            // Ignore fetch errors, proceed to name search
        }
    }

    // 2. Fallback to searching by role name (case-insensitive)
    const roleName = trimmedInput.toLowerCase();
    const foundRole = guild.roles.cache.find(r => r.name.toLowerCase() === roleName);
    
    return foundRole || null;
}

/**
 * Parses a string that may contain abbreviations like 'k' for thousands.
 * Handles commas and decimal points correctly.
 * @param {string} amountStr The string to parse.
 * @returns {number|null} The parsed integer amount, or null if invalid.
 */
function parseFlexibleAmount(amountStr) {
    if (!amountStr || typeof amountStr !== 'string') return null;

    let cleanStr = amountStr.trim().toLowerCase().replace(/,/g, '');
    let multiplier = 1;

    if (cleanStr.endsWith('k')) {
        multiplier = 1000;
        cleanStr = cleanStr.slice(0, -1);
    } else if (cleanStr.endsWith('m')) {
        multiplier = 1000000;
        cleanStr = cleanStr.slice(0, -1);
    }

    const num = parseFloat(cleanStr);
    if (isNaN(num) || num < 0) {
        return null;
    }

    return Math.floor(num * multiplier);
}


module.exports = { parseUser, parseRole, parseFlexibleAmount };