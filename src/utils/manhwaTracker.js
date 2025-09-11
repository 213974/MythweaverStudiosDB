// utils/manhwaTracker.js
const axios = require('axios');
const cheerio = require('cheerio');

// The URL for the MangaUpdates page (for chapter number)
const MANGAUPDATES_URL = 'https://www.mangaupdates.com/series/r4ksmo5/pick-me-up';
// The primary reading link you provided
const ASURA_URL = 'https://asuracomic.net/series/pick-me-up-infinite-gacha-ef200185';
// The secondary reading link you provided
const COMICK_URL = 'https://comick.io/comic/02-pick-me-up-1';

// A list of trusted English scanlation groups to look for
const TARGET_GROUPS = ['Asura Scans', 'Luminous Scans'];

async function getLatestChapterInfo() {
    try {
        // Use a common user-agent to avoid simple bot blockers
        const response = await axios.get(MANGAUPDATES_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = response.data;
        const $ = cheerio.load(html);

        let latestChapter = null;

        // Find the div with the text "Latest Releases" and search within its siblings for the chapter info
        const releaseHeader = $('div.sCat:contains("Latest Releases")');
        // The actual content is usually in a sibling div
        const contentDiv = releaseHeader.next('div.sContent');

        contentDiv.find('.row').each((i, el) => {
            const groupName = $(el).find('a[title="Group"]').text().trim();
            
            // Check if the group is one of our targets
            if (TARGET_GROUPS.includes(groupName)) {
                const chapterText = $(el).find('.col-3.text-truncate').first().text().trim();
                // The text is usually 'c.###' or 'c.### [end]', we just want the number part
                const match = chapterText.match(/c\.(\d+(\.\d+)?)/); // Regex to find c. followed by numbers
                if (match && match[1]) {
                    latestChapter = match[1];
                    return false; // Stop the loop once we find the first valid match
                }
            }
        });

        if (latestChapter) {
            return {
                chapter: latestChapter,
                link1: ASURA_URL,
                link2: COMICK_URL,
                error: null
            };
        } else {
            return {
                chapter: 'Unknown',
                link1: ASURA_URL,
                link2: COMICK_URL,
                error: 'Could not find a recent English chapter on the page.'
            };
        }
    } catch (error) {
        console.error('[ManhwaTracker] Failed to scrape MangaUpdates:', error);
        return {
            chapter: 'Unknown',
            link1: ASURA_URL,
            link2: COMICK_URL,
            error: 'Failed to fetch the chapter information.'
        };
    }
}

module.exports = { getLatestChapterInfo };