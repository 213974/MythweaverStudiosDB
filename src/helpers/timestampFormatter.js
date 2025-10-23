// src/helpers/timestampFormatter.js
module.exports = {
    formatTimestamp: (unixTimestamp, style = 'R') => {
        if (!unixTimestamp) return 'Timestamp not available';
        return `<t:${Math.floor(unixTimestamp)}:${style}>`;
    }
};