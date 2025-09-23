// src/utils/interactionHelpers.js

async function parseUser(guild, userInput) {
    const matches = userInput.match(/^(?:<@!?)?(\d{17,19})>?$/);
    if (matches) return guild.members.fetch(matches[1]).catch(() => null);
    return null;
}

async function parseRole(guild, roleInput) {
    const matches = roleInput.match(/^(?:<@&)?(\d{17,19})>?$/);
    if (matches) return guild.roles.fetch(matches[1]).catch(() => null);
    return null;
}

module.exports = { parseUser, parseRole };