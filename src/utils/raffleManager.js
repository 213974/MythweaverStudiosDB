// src/utils/raffleManager.js
const { EmbedBuilder, ActionRowBuilder } = require('discord.js');
const db = require('./database');

async function drawRaffleWinners(client, raffleId) {
    const raffle = db.prepare('SELECT * FROM raffles WHERE raffle_id = ?').get(raffleId);
    if (!raffle || raffle.status !== 'active') {
        return { success: false, message: 'Raffle not found or has already ended.' };
    }

    const entries = db.prepare('SELECT user_id FROM raffle_entries WHERE raffle_id = ?').all(raffle.raffle_id);
    const channel = await client.channels.fetch(raffle.channel_id).catch(() => null);
    if (!channel) {
        db.prepare("UPDATE raffles SET status = 'ended', winner_id = 'Error: Channel not found' WHERE raffle_id = ?").run(raffle.raffle_id);
        return { success: false, message: 'Could not find the raffle channel.' };
    }

    let winners = [];
    if (entries.length > 0) {
        const uniqueParticipants = [...new Set(entries.map(e => e.user_id))];
        const shuffled = uniqueParticipants.sort(() => 0.5 - Math.random());
        winners = shuffled.slice(0, raffle.num_winners);
    }

    db.prepare("UPDATE raffles SET status = 'ended', winner_id = ? WHERE raffle_id = ?").run(winners.join(','), raffle.raffle_id);
    
    // Send a separate message to ping winners
    if (winners.length > 0) {
        await channel.send({ content: `Congratulations ${winners.map(id => `<@${id}>`).join(', ')}! You won the **${raffle.title}** raffle!` }).catch(e => console.error("Raffle winner ping failed:", e));
    }
    
    // Attempt to edit the original raffle message with the results
    const originalMessage = await channel.messages.fetch(raffle.message_id).catch(() => null);
    if (originalMessage) {
        const endedEmbed = EmbedBuilder.from(originalMessage.embeds[0])
            .setColor('#808080')
            .setTitle(`🎉 Raffle Ended: ${raffle.title} 🎉`);

        // Clear existing fields and add new result fields
        endedEmbed.setFields(
            { name: 'Winner(s)', value: winners.length > 0 ? winners.map(id => `<@${id}>`).join('\n') : 'No entries were submitted.' },
            { name: 'Total Participants', value: (new Set(entries.map(e => e.user_id))).size.toLocaleString() }
        );

        // Disable all components on the message
        const disabledComponents = originalMessage.components.map(row => {
            const newRow = ActionRowBuilder.from(row);
            newRow.components.forEach(component => component.setDisabled(true));
            return newRow;
        });
        
        await originalMessage.edit({ embeds: [endedEmbed], components: disabledComponents });
    } else {
        // Fallback if the original message was deleted
        const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
        const announcementDescription = winners.length > 0 
            ? `The raffle has concluded! Congratulations to our winner(s):\n\n${winnerMentions}`
            : 'The raffle has ended, but there were no entries.';
            
        const announcementEmbed = new EmbedBuilder()
            .setColor('#808080')
            .setTitle(`🎉 Raffle Ended: ${raffle.title} 🎉`)
            .setDescription(announcementDescription)
            .addFields(
                { name: 'Total Participants', value: (new Set(entries.map(e => e.user_id))).size.toLocaleString() }
            )
            .setTimestamp();
        await channel.send({ embeds: [announcementEmbed] });
    }

    return { success: true, message: `Raffle ID ${raffleId} has been successfully ended.` };
}

module.exports = { drawRaffleWinners };