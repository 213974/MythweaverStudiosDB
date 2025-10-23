// handlers/chatInputCommandHandler.js
const { Collection } = require('discord.js');
const COMMAND_COOLDOWN_SECONDS = 2.5;

module.exports = async (interaction, client) => {
    const command = client.commands.get(interaction.commandName);
    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return interaction.reply({ content: 'Error: Command not found.', flags: 64 });
    }

    const cooldowns = client.cooldowns.get('commands') || new Collection();
    const now = Date.now();
    const userTimestamp = cooldowns.get(interaction.user.id);

    if (userTimestamp) {
        const expirationTime = userTimestamp + COMMAND_COOLDOWN_SECONDS * 1000;
        if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            return interaction.reply({ content: `Please wait ${timeLeft.toFixed(1)} more second(s) before using a command again.`, flags: 64 });
        }
    }

    cooldowns.set(interaction.user.id, now);
    client.cooldowns.set('commands', cooldowns);
    setTimeout(() => cooldowns.delete(interaction.user.id), COMMAND_COOLDOWN_SECONDS * 1000);
    
    // Analytics tracking is now correctly handled within the economyManager
    // upon a SUCCESSFUL claim, so we remove it from here entirely.
    
    await command.execute(interaction);
};