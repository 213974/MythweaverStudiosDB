// src/utils/scheduler.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('./database');
const { formatTimestamp } = require('./timestampFormatter');

// Function to shuffle an array (Fisher-Yates shuffle)
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

async function checkEndedRaffles(client) {
    const now = Math.floor(Date.now() / 1000);
    const endedRaffles = db.prepare('SELECT * FROM raffles WHERE status = ? AND end_timestamp <= ?').all('active', now);

    for (const raffle of endedRaffles) {
        console.log(`[Scheduler] Processing ended raffle ID: ${raffle.raffle_id}`);
        try {
            // Get all entries for this raffle
            const entries = db.prepare('SELECT user_id FROM raffle_entries WHERE raffle_id = ?').all(raffle.raffle_id);
            const channel = await client.channels.fetch(raffle.channel_id).catch(() => null);
            if (!channel) {
                db.prepare("UPDATE raffles SET status = 'ended', winner_id = 'Channel not found' WHERE raffle_id = ?").run(raffle.raffle_id);
                continue; // Move to the next raffle
            }

            let winners = [];
            let announcementDescription;

            if (entries.length === 0) {
                announcementDescription = 'The raffle has ended, but there were no entries. No winners were chosen.';
            } else {
                // Get a list of unique participants
                const uniqueParticipants = [...new Set(entries.map(e => e.user_id))];
                const shuffledParticipants = shuffle(uniqueParticipants);
                // Select the winners
                winners = shuffledParticipants.slice(0, raffle.num_winners);

                const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
                announcementDescription = `The raffle for **${raffle.title}** has concluded! Congratulations to our winner(s):\n\n${winnerMentions}`;
            }

            // Update the raffle in the database
            db.prepare("UPDATE raffles SET status = 'ended', winner_id = ? WHERE raffle_id = ?").run(winners.join(','), raffle.raffle_id);
            
            // Announce the results
            const announcementEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle(`🎉 Raffle Ended: ${raffle.title} 🎉`)
                .setDescription(announcementDescription)
                .addFields({ name: 'Total Entries', value: entries.length.toLocaleString(), inline: true })
                .setTimestamp();
            
            await channel.send({ content: winners.length > 0 ? winners.map(id => `<@${id}>`).join(' ') : '', embeds: [announcementEmbed] });

            // Disable the button on the original message
            const originalMessage = await channel.messages.fetch(raffle.message_id).catch(() => null);
            if (originalMessage) {
                const endedEmbed = EmbedBuilder.from(originalMessage.embeds[0]).setColor('#808080').addFields({ name: 'Status', value: 'This raffle has ended.'});
                const disabledButton = ButtonBuilder.from(originalMessage.components[0].components[0]).setDisabled(true);
                const disabledRow = new ActionRowBuilder().addComponents(disabledButton);
                await originalMessage.edit({ embeds: [endedEmbed], components: [disabledRow] });
            }

        } catch (error) {
            console.error(`[Scheduler] Failed to process raffle ID ${raffle.raffle_id}:`, error);
        }
    }
}

function startScheduler(client) {
    console.log('[Scheduler] Raffle scheduler started. Checking every 60 seconds.');
    // Run once on startup, then every 60 seconds
    checkEndedRaffles(client);
    setInterval(() => checkEndedRaffles(client), 60 * 1000);
}

module.exports = { startScheduler };