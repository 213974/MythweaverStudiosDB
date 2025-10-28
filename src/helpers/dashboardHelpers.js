// src/utils/dashboardHelpers.js

/**
 * A centralized array of GIFs for use in various dashboards.
 */
const GIFS = [
    'https://i.pinimg.com/originals/56/34/9f/56349f764173af321a640f6e1bac22fd.gif',
    'https://i.pinimg.com/originals/9d/3e/2f/9d3e2f3f2e46a9f4dd0a016415433af8.gif',
    'https://i.pinimg.com/originals/0f/43/10/0f4310bc3442432f7667605968cc9e80.gif',
    'https://i.pinimg.com/originals/92/97/74/929774b033a66c070f5da21ef21c0090.gif',
    'https://i.pinimg.com/originals/a3/63/9b/a3639be246d40f97fddbcd888b1b1a60.gif',
    'https://i.pinimg.com/originals/30/08/db/3008dbaf2f61f56b04ae4cb0cf4cc29e.gif',
    'https://i.pinimg.com/originals/f9/8e/c7/f98ec7527d99f04717fab0fc8d49d2b5.gif',
    'https://i.pinimg.com/originals/43/d4/d7/43d4d7e5ba1cfa7959a1fab8d64f22ea.gif',
    'https://i.pinimg.com/originals/eb/92/91/eb92919f672895886c3eed33f5173db2.gif',
    'https://i.pinimg.com/originals/57/a9/77/57a9773c9882d66c4ab70373de13fb1c.gif',
    'https://i.pinimg.com/originals/db/91/99/db9199a6ad9c6c1cffe1658f0f159db5.gif',
    'https://i.pinimg.com/originals/ae/b2/14/aeb2149471de2abc2be9d58b1c62b38f.gif',
    'https://i.pinimg.com/originals/fe/a5/3a/fea53ac58aebd04b59de22c9bf9ca8ae.gif',
    'https://i.pinimg.com/originals/ad/93/2d/ad932df681ef1671fbb801e558d0e320.gif',
    'https://i.pinimg.com/originals/70/99/8e/70998e788ce8ae499fa9eec5b8ad2df1.gif',
    'https://i.pinimg.com/originals/16/2f/22/162f2252116e12165daae9a0d03c689e.gif'

];

/**
 * Selects a random GIF from the centralized array.
 * @returns {string} A URL to a random GIF.
 */
function getRandomGif() {
    return GIFS[Math.floor(Math.random() * GIFS.length)];
}

module.exports = {
    getRandomGif
};