// commands/utility/timestamp.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const chrono = require('chrono-node');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timestamp')
        .setDescription('Generates a dynamic Discord timestamp from a natural language date and time.')
        .addStringOption(option =>
            option.setName('datetime')
                .setDescription("The date and time (e.g., 'tomorrow at 4pm', 'March 20th 17:30', 'in 2 hours')")
                .setRequired(true))
        .addStringOption(option =>
            option.setName('timezone')
                .setDescription('Optional: Your IANA timezone (e.g., America/New_York). Defaults to bot\'s local time.')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('format')
                .setDescription('The display format for the timestamp.')
                .setRequired(false)
                .addChoices(
                    { name: 'Short Date/Time (e.g., November 20, 2024 4:30 PM)', value: 'f' },
                    { name: 'Long Date/Time (e.g., Wednesday, November 20, 2024 4:30 PM)', value: 'F' },
                    { name: 'Short Date (e.g., 11/20/2024)', value: 'd' },
                    { name: 'Long Date (e.g., November 20, 2024)', value: 'D' },
                    { name: 'Short Time (e.g., 4:30 PM)', value: 't' },
                    { name: 'Long Time (e.g., 4:30:00 PM)', value: 'T' },
                    { name: 'Relative Time (e.g., in 2 months)', value: 'R' }
                )),
    async execute(interaction) {
        const dateTimeStr = interaction.options.getString('datetime');
        const timezoneStr = interaction.options.getString('timezone');
        const formatStyle = interaction.options.getString('format') ?? 'F'; // Default to Long Date/Time

        try {
            // Use chrono-node to parse the date string.
            // We pass the timezone to the 'moment' option for chrono to use as a reference.
            const referenceDate = new Date();
            const parsedResult = chrono.parse(dateTimeStr, { instant: referenceDate, timezone: timezoneStr });

            if (parsedResult.length === 0) {
                return interaction.reply({
                    content: "I couldn't understand that date and time. Please try a clearer format (e.g., `March 20 5pm`, `tomorrow 17:00`).\nIf providing a timezone, make sure it's at the end.",
                    flags: 64
                });
            }

            const parsedDate = parsedResult[0].start.date();

            // Get the Unix timestamp (in seconds)
            const unixTimestamp = Math.floor(parsedDate.getTime() / 1000);

            // Generate all timestamp formats for user to copy
            const t_short = `<t:${unixTimestamp}:t> \`\`<t:${unixTimestamp}:t>\`\``;
            const T_long = `<t:${unixTimestamp}:T> \`\`<t:${unixTimestamp}:T>\`\``;
            const d_short = `<t:${unixTimestamp}:d> \`\`<t:${unixTimestamp}:d>\`\``;
            const D_long = `<t:${unixTimestamp}:D> \`\`<t:${unixTimestamp}:D>\`\``;
            const f_short = `<t:${unixTimestamp}:f> \`\`<t:${unixTimestamp}:f>\`\``;
            const F_long = `<t:${unixTimestamp}:F> \`\`<t:${unixTimestamp}:F>\`\``;
            const R_relative = `<t:${unixTimestamp}:R> \`\`<t:${unixTimestamp}:R>\`\``;

            // Get a human-readable confirmation of the input time
            const confirmationTime = parsedDate.toLocaleString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                hour: 'numeric', minute: 'numeric', timeZoneName: 'short',
                ... (timezoneStr && { timeZone: timezoneStr })
            });

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('Discord Timestamp Generator')
                .setDescription(`Successfully generated timestamps for **${confirmationTime}**.`)
                .addFields(
                    { name: 'Your Chosen Format', value: `<t:${unixTimestamp}:${formatStyle}>` },
                    { name: 'All Formats (Copy the one you need)', value: `Short Time: ${t_short}\nLong Time: ${T_long}\nShort Date: ${d_short}\nLong Date: ${D_long}\nShort Date/Time: ${f_short}\nLong Date/Time: ${F_long}\nRelative: ${R_relative}` }
                )
                .setFooter({ text: 'This timestamp will appear correctly for everyone in their local time.' });

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('[TimestampCommand] Error generating timestamp:', error);
            await interaction.reply({ content: 'An error occurred while parsing the date. Please check your input.', flags: 64 });
        }
    },
};