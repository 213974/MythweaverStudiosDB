// src/managers/dropManager.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Collection } = require('discord.js');
const db = require('../utils/database');
const walletManager = require('./economy/walletManager');
const { formatTimestamp } = require('../helpers/timestampFormatter');

const DROP_EMOJI = '🎊';
const DROP_FOOTER_TEXT = 'Solyx Drop Event';

// --- Helper Functions ---

function getDropSettings(guildId) {
    const settingsRaw = db.prepare("SELECT key, value FROM settings WHERE guild_id = ? AND key LIKE 'drop_%'").all(guildId);
    const settings = new Map(settingsRaw.map(s => [s.key, s.value]));

    return {
        enabled: settings.get('drop_enabled') === 'true',
        interval: parseInt(settings.get('drop_interval_minutes') || '60', 10),
        duration: parseInt(settings.get('drop_duration_seconds') || '60', 10),
        warning: parseInt(settings.get('drop_warning_seconds') || '10', 10),
        requiredReactors: parseInt(settings.get('drop_reactors_required') || '2', 10),
        minSolyx: parseInt(settings.get('drop_min_solyx') || '100', 10),
        maxSolyx: parseInt(settings.get('drop_max_solyx') || '1000', 10),
        channelMode: settings.get('drop_channel_mode') || 'whitelist',
        channels: JSON.parse(settings.get('drop_channels') || '[]'),
    };
}

/**
 * Distributes a total amount of Solyx as evenly as possible among a list of winners.
 * @param {number} totalSolyx The total amount to distribute.
 * @param {string[]} winnerIds An array of the winners' user IDs.
 * @returns {Map<string, number>} A map of user IDs to the amount they won.
 */
function calculateWinnings(totalSolyx, winnerIds) {
    const winnerCount = winnerIds.length;
    if (winnerCount === 0) return new Map();

    const baseAmount = Math.floor(totalSolyx / winnerCount);
    const remainder = totalSolyx % winnerCount;
    const winnings = new Map();

    for (let i = 0; i < winnerCount; i++) {
        const userId = winnerIds[i];
        let amount = baseAmount;
        if (i < remainder) {
            amount += 1;
        }
        winnings.set(userId, amount);
    }
    return winnings;
}


// --- Core Module ---

module.exports = {
    async initiateDrop(client, channel, isManual = false) {
        if (!channel) return;

        const settings = getDropSettings(channel.guild.id);
        if (!settings.enabled && !isManual) return;

        const solyxAmount = Math.floor(Math.random() * (settings.maxSolyx - settings.minSolyx + 1)) + settings.minSolyx;
        
        const initialEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('<a:Yellow_Gem:1427764380489224295> A Solyx Drop has Appeared! <a:Yellow_Gem:1427764380489224295>')
            .setDescription(`A treasure of **${solyxAmount.toLocaleString()}** Solyx™ has dropped!\nThe first **${settings.requiredReactors}** user(s) to react with ${DROP_EMOJI} will claim a share!`)
            .addFields({
                name: '<a:Sand_Time:1429464150467281046> Time Remaining',
                value: `Disappears ${formatTimestamp(Math.floor(Date.now() / 1000) + settings.duration, 'R')}`
            })
            .setFooter({ text: DROP_FOOTER_TEXT });

        const message = await channel.send({ embeds: [initialEmbed] });
        await message.react(DROP_EMOJI);

        const collector = message.createReactionCollector({
            filter: (reaction, user) => reaction.emoji.name === DROP_EMOJI && !user.bot,
            time: settings.duration * 1000,
            maxUsers: settings.requiredReactors
        });

        collector.on('end', async (collected, reason) => {
            const winners = collected.map(reaction => reaction.users.cache.filter(user => !user.bot).first());

            if (winners.length >= settings.requiredReactors) {
                // SUCCESS
                const winnings = calculateWinnings(solyxAmount, winners.map(w => w.id));

                const successEmbed = EmbedBuilder.from(initialEmbed)
                    .setColor('#2ECC71')
                    .setTitle('<a:Golden_Check:1427763589732634746> Solyx Drop Claimed! <a:Golden_Check:1427763589732634746>')
                    .setDescription(`The **${solyxAmount.toLocaleString()}** Solyx™ was claimed by:\n${winners.map(w => w.toString()).join(', ')}`)
                    .setFields([]);

                await message.edit({ embeds: [successEmbed], components: [] });

                for (const winner of winners) {
                    const amountWon = winnings.get(winner.id);
                    const oldBalance = walletManager.getConsolidatedBalance(winner.id, channel.guild.id);
                    walletManager.modifySolyx(winner.id, channel.guild.id, amountWon, 'Solyx Drop Claim');
                    const newBalance = oldBalance + amountWon;
                    
                    try {
                        const dmEmbed = new EmbedBuilder()
                            .setColor('#3498DB')
                            .setTitle('<:Neon_Heart:1431059950653800528> You Claimed a Solyx Drop! <:Neon_Heart:1431059950653800528>')
                            .setDescription(`You were one of the first to react in **${channel.guild.name}**!`)
                            .addFields(
                                { name: 'Amount Won', value: `${amountWon.toLocaleString()} <a:Solyx_Currency:1431059951664627712>`, inline: false },
                                { name: 'Old Balance', value: `${oldBalance.toLocaleString()} <a:Solyx_Currency:1431059951664627712>`, inline: true },
                                { name: 'New Balance', value: `${newBalance.toLocaleString()} <a:Solyx_Currency:1431059951664627712>`, inline: true }
                            );
                        await winner.send({ embeds: [dmEmbed] });
                    } catch (e) {
                        console.warn(`[DropManager] Could not DM winner ${winner.tag}`);
                    }
                }

            } else {
                // FAILURE (Timer ran out)
                const warningEmbed = EmbedBuilder.from(initialEmbed)
                    .setColor('#E67E22')
                    .setDescription(`The drop is fading away... Quick!\nIt will disappear ${formatTimestamp(Math.floor(Date.now() / 1000) + settings.warning, 'R')}`)
                    .setFields([]);
                await message.edit({ embeds: [warningEmbed] });

                setTimeout(async () => {
                    const finalEmbed = EmbedBuilder.from(warningEmbed)
                        .setColor('#E74C3C')
                        .setTitle('<a:Golden_X:1427763627146088579> Solyx Drop Expired <a:Golden_X:1427763627146088579>')
                        .setDescription('The Solyx drop faded away before it could be claimed.');
                    await message.edit({ embeds: [finalEmbed], components: [] }).catch(() => {}); // Ignore if message was deleted
                }, settings.warning * 1000);
            }
        });
    },

    async cleanupOrphanedDrops(client) {
        console.log('[DropManager] Cleaning up any orphaned Solyx Drops from previous session...');
        for (const [guildId, guild] of client.guilds.cache) {
            const settings = getDropSettings(guildId);
            if (!settings.enabled || settings.channels.length === 0) continue;

            for (const channelId of settings.channels) {
                try {
                    const channel = await guild.channels.fetch(channelId);
                    const messages = await channel.messages.fetch({ limit: 20 });
                    for (const message of messages.values()) {
                        if (message.author.id === client.user.id && message.embeds[0]?.footer?.text === DROP_FOOTER_TEXT) {
                            // If the embed title doesn't say "Claimed" or "Expired", it's an orphan.
                            if (!message.embeds[0].title.includes('Claimed') && !message.embeds[0].title.includes('Expired')) {
                                const expiredEmbed = EmbedBuilder.from(message.embeds[0])
                                    .setColor('#808080')
                                    .setTitle('<a:Golden_X:1427763627146088579> Solyx Drop Expired <a:Golden_X:1427763627146088579>')
                                    .setDescription('This drop expired due to a bot restart.')
                                    .setFields([]);
                                await message.edit({ embeds: [expiredEmbed], components: [] });
                                console.log(`[DropManager] Cleaned up orphaned drop in channel ${channel.name}.`);
                            }
                        }
                    }
                } catch (error) {
                    console.warn(`[DropManager Cleanup] Could not access or clean channel ${channelId}:`, error.message);
                }
            }
        }
    },
    
    getDropSettings
};