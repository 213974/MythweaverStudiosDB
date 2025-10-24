// src/events/voiceStateUpdate.js
const { Events } = require('discord.js');
const db = require('../utils/database');
const economyManager = require('../managers/economyManager');
const userManager = require('../managers/userManager');
const { getSettings } = require('../utils/settingsCache');

// Function to get settings from the database (could be cached in a real scenario)
function getVcSystemSettings(guildId) {
    const settings = getSettings(guildId);
    return {
        enabled: settings.get('system_solyx_vc_enabled') === 'true',
        rate: parseFloat(settings.get('system_solyx_vc_rate') || '0.1'),
        interval: parseInt(settings.get('system_solyx_vc_interval_minutes') || '5', 10) * 60 * 1000, // in ms
    };
}

function startVcSession(member, client) {
    const { guild, id: userId } = member;
    const settings = getVcSystemSettings(guild.id);

    if (!settings.enabled || settings.rate <= 0 || settings.interval <= 0) {
        return; // System is disabled or configured incorrectly
    }

    // Stop any existing session for this user to prevent duplicates
    stopVcSession(member, client);

    const intervalId = setInterval(() => {
        // Re-fetch member and channel state inside the interval to ensure it's current
        const currentMember = guild.members.cache.get(userId);
        if (!currentMember || !currentMember.voice.channel) {
            stopVcSession({ id: userId, guild }, client); // Pass a mock member object if the original is gone
            return;
        }

        const channel = currentMember.voice.channel;
        const isAlone = channel.members.size <= 1;
        const isDeafened = currentMember.voice.serverDeaf;

        if (!isAlone && !isDeafened) {
            // --- CORE FIX ---
            // Changed the incorrect call from 'addSolyx' to the correct 'modifySolyx'
            economyManager.modifySolyx(userId, guild.id, settings.rate, 'Voice Chat Activity');
            userManager.addSolyxFromSource(userId, guild.id, settings.rate, 'vc');
        }

    }, settings.interval);

    client.activeVcSessions.set(userId, {
        intervalId,
        joinTime: Date.now()
    });

    console.log(`[VC] Started Solyx session for ${member.user.tag}.`);
}

function stopVcSession(member, client) {
    const { guild, id: userId } = member;
    const session = client.activeVcSessions.get(userId);

    if (session) {
        clearInterval(session.intervalId);
        const sessionDuration = Date.now() - session.joinTime;
        userManager.incrementVcTime(userId, guild.id, sessionDuration);
        client.activeVcSessions.delete(userId);
        console.log(`[VC] Stopped Solyx session for user ID ${userId}. Duration: ${Math.round(sessionDuration / 1000)}s`);
    }
}


function updateUserVcState(member, client) {
    const channel = member.voice.channel;
    const session = client.activeVcSessions.get(member.id);

    // If user is in a channel
    if (channel) {
        const isAlone = channel.members.size <= 1;
        const isDeafened = member.voice.serverDeaf;
        
        // Condition to START a session
        if (!session && !isAlone && !isDeafened) {
            startVcSession(member, client);
        }
        // Conditions to STOP an existing session
        else if (session && (isAlone || isDeafened)) {
            stopVcSession(member, client);
        }
    } 
    // If user is not in a channel, ensure session is stopped
    else {
        stopVcSession(member, client);
    }
}

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState, client) {
        const member = newState.member || oldState.member;

        // Ignore bots
        if (member.user.bot) return;
        
        // Update state for the user who moved
        updateUserVcState(member, client);

        // If another user was left alone in the old channel, stop their session
        if (oldState.channel && oldState.channel.members.size === 1) {
            const lastMember = oldState.channel.members.first();
            if (lastMember) {
                 updateUserVcState(lastMember, client);
            }
        }

        // If a user joins a channel where someone was alone, start a session for that other person
        if (newState.channel && newState.channel.members.size === 2) {
            newState.channel.members.forEach(m => {
                if (m.id !== member.id) {
                     updateUserVcState(m, client);
                }
            });
        }
    },
};