// src/helpers/interactionHelpers.js

async function parseUser(guild, userInput) {
    if (!userInput) return null;
    const trimmedInput = userInput.trim();

    const mentionOrIdMatch = trimmedInput.match(/^(?:<@!?)?(\d{17,19})>?$/);
    if (mentionOrIdMatch) {
        try {
            const member = await guild.members.fetch(mentionOrIdMatch[1]);
            if (member) return member;
        } catch (error) {
            // Ignore fetch errors
        }
    }

    try {
        const members = await guild.members.search({ query: trimmedInput, limit: 1 });
        return members.first() || null;
    } catch (error) {
        console.error(`[parseUser] Failed to search for member "${trimmedInput}":`, error);
        return null;
    }
}

async function parseRole(guild, roleInput) {
    if (!roleInput) return null;
    const trimmedInput = roleInput.trim();

    const mentionOrIdMatch = trimmedInput.match(/^(?:<@&)?(\d{17,19})>?$/);
    if (mentionOrIdMatch) {
        try {
            const role = await guild.roles.fetch(mentionOrIdMatch[1]);
            if (role) return role;
        } catch (error) {
            // Ignore fetch errors
        }
    }

    const roleName = trimmedInput.toLowerCase();
    const foundRole = guild.roles.cache.find(r => r.name.toLowerCase() === roleName);
    
    return foundRole || null;
}

module.exports = { parseUser, parseRole };