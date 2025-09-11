// utils/timestampFormatter.js
// Formats a Unix timestamp for Discord's dynamic timestamp display.
// For example, to show "in a minute" or "2 minutes ago".
// style: R (Relative), F (Full DateTime), f (Short DateTime), D (Short Date), T (Short Time), d (Long Date), t (Long Time)
module.exports = {
    formatTimestamp: (unixTimestamp, style = 'R') => {
        if (!unixTimestamp) return 'Timestamp not available';
        return `<t:${Math.floor(unixTimestamp)}:${style}>`;
    }
};