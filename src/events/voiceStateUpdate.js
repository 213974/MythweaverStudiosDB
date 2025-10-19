// src/events/voiceStateUpdate.js
const { Events, Collection } = require('discord.js');
const db = require('../utils/database');
const economyManager = require('../utils/economyManager');
const userManager = require('../utils/userManager');

const activeVcSessions = new Map();

// Function to get settings from the database (could be cached in a real scenario)
function getVcSystemSettings(guildId) {
    const settingsRaw = db.prepare("SELECT key, value FROM settings WHERE guild_id = ? AND key LIKE 'system_solyx_vc_%'").all(guildId);
    const settings = new Map(settingsRaw.map(s => [s.key, s.value]));
    return {
        enabled: settings.get('system_solyx_vc_enabled') === 'true',
        rate: parseFloat(settings.get('system_solyx_vc_rate') || '0.1'),
        interval: parseInt(settings.get('system_solyx_vc_interval_minutes') || '5', 10) * 60 * 1000, // in ms
    };
}

function startVcSession(member) {
    const { guild, id: userId } = member;
    const settings = getVcSystemSettings(guild.id);

    if (!settings.enabled || settings.rate <= 0 || settings.interval <= 0) {
        return; // System is disabled or configured incorrectly
    }

    // Stop any existing session for this user to prevent duplicates
    stopVcSession(member);

    const intervalId = setInterval(() => {
        // Re-fetch member and channel state inside the interval to ensure it's current
        const currentMember = guild.members.cache.get(userId);
        if (!currentMember || !currentMember.voice.channel) {
            stopVcSession(member);
            return;
        }

        const channel = currentMember.voice.channel;
        const isAlone = channel.members.size <= 1;
        const isDeafened = currentMember.voice.serverDeaf;

        if (!isAlone && !isDeafened) {
            economyManager.addSolyx(userId, guild.id, settings.rate, 'Voice Chat Activity');
            userManager.addSolyxFromSource(userId, guild.id, settings.rate, 'vc');
        }

    }, settings.interval);

    activeVcSessions.set(userId, {
        intervalId,
        joinTime: Date.now(),
        isDeafened: member.voice.serverDeaf, // Store initial deafen state
    });

    console.log(`[VC] Started Solyx session for ${member.user.tag}.`);
}

function stopVcSession(member) {
    const { guild, id: userId } = member;
    const session = activeVcSessions.get(userId);

    if (session) {
        clearInterval(session.intervalId);
        const sessionDuration = Date.now() - session.joinTime;
        userManager.incrementVcTime(userId, guild.id, sessionDuration);
        activeVcSessions.delete(userId);
        console.log(`[VC] Stopped Solyx session for ${member.user.tag}. Duration: ${Math.round(sessionDuration / 1000)}s`);
    }
}


function updateUserVcState(member) {
    const channel = member.voice.channel;
    const session = activeVcSessions.get(member.id);

    // If user is in a channel
    if (channel) {
        const isAlone = channel.members.size <= 1;
        const isDeafened = member.voice.serverDeaf;
        
        // Condition to START a session
        if (!session && !isAlone && !isDeafened) {
            startVcSession(member);
        }
        // Conditions to STOP an existing session
        else if (session && (isAlone || isDeafened)) {
            stopVcSession(member);
        }
    } 
    // If user is not in a channel, ensure session is stopped
    else {
        stopVcSession(member);
    }
}

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        const member = newState.member || oldState.member;

        // Ignore bots
        if (member.user.bot) return;

        // When a user joins, leaves, or moves channels, we need to check the state
        // of both the old and new channels.
        
        // Update state for the user who moved
        updateUserVcState(member);

        // If another user was left alone in the old channel, stop their session
        if (oldState.channel && oldState.channel.members.size === 1) {
            const lastMember = oldState.channel.members.first();
            if (lastMember) {
                 updateUserVcState(lastMember);
            }
        }

        // If a user joins a channel where someone was alone, start a session for that other person
        if (newState.channel && newState.channel.members.size === 2) {
            newState.channel.members.forEach(m => {
                if (m.id !== member.id) {
                     updateUserVcState(m);
                }
            });
        }
    },
};