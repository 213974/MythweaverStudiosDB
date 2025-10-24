// services/imageGenerator/welcomeBanner.js
const sharp = require('sharp');
const axios = require('axios');

// --- Image & Layout Constants ---
const BACKGROUND_IMAGE_URL = 'https://i.pinimg.com/1200x/7c/dd/a0/7cdda0f55609c37bd94b93f215d763ba.jpg';
const IMAGE_WIDTH = 1199;
const IMAGE_HEIGHT = 672;

// --- Avatar Constants ---
const AVATAR_SIZE = 256;
const AVATAR_TOP_Y = 58; // Vertical position from the top in pixels. Smaller number = higher up.

// --- Text Constants (Pixel-based for predictable layout) ---
const WELCOME_TEXT_Y = 445; // Vertical position from the top in pixels.
const USERNAME_TEXT_Y = 515; // Vertical position from the top in pixels.

/**
 * Creates a custom welcome banner image.
 * @param {string} avatarUrl The URL of the user's avatar.
 * @param {string} username The username of the user.
 * @returns {Promise<Buffer|null>} A buffer of the generated JPEG image, or null if an error occurs.
 */
async function createWelcomeBanner(avatarUrl, username) {
    try {
        // --- 1. Download and prepare images ---
        const backgroundResponse = await axios.get(BACKGROUND_IMAGE_URL, { responseType: 'arraybuffer' });
        const backgroundBuffer = Buffer.from(backgroundResponse.data, 'binary');

        const avatarResponse = await axios.get(avatarUrl, { responseType: 'arraybuffer' });
        const avatarBuffer = Buffer.from(avatarResponse.data, 'binary');

        // --- 2. Create circular avatar ---
        const circleMask = Buffer.from(
            `<svg><circle cx="${AVATAR_SIZE / 2}" cy="${AVATAR_SIZE / 2}" r="${AVATAR_SIZE / 2}" /></svg>`
        );

        const circularAvatar = await sharp(avatarBuffer)
            .resize(AVATAR_SIZE, AVATAR_SIZE)
            .composite([{
                input: circleMask,
                blend: 'dest-in'
            }])
            .png()
            .toBuffer();

        // --- 3. Create text overlays with neon glow effect ---
        const welcomeTextSvg = Buffer.from(`
            <svg width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}">
                <defs>
                    <filter id="glow_white">
                        <feDropShadow dx="0" dy="0" stdDeviation="4.5" flood-color="white"/>
                    </filter>
                </defs>
                <style>
                    .title { fill: white; font-size: 100px; font-weight: bold; font-family: sans-serif; }
                </style>
                <text x="50%" y="${WELCOME_TEXT_Y}" text-anchor="middle" class="title" filter="url(#glow_white)">WELCOME</text>
            </svg>
        `);

        const userTextSvg = Buffer.from(`
            <svg width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}">
                 <defs>
                    <filter id="glow_white_sub">
                        <feDropShadow dx="0" dy="0" stdDeviation="3.5" flood-color="white"/>
                    </filter>
                </defs>
                <style>
                    .subtitle { fill: white; font-size: 48px; font-weight: bold; font-family: sans-serif; }
                </style>
                <text x="50%" y="${USERNAME_TEXT_Y}" text-anchor="middle" class="subtitle" filter="url(#glow_white_sub)">${username.toUpperCase()}</text>
            </svg>
        `);

        // --- 4. Composite all layers ---
        const finalImage = await sharp(backgroundBuffer)
            .composite([
                {
                    input: circularAvatar,
                    top: AVATAR_TOP_Y,
                    left: Math.round((IMAGE_WIDTH / 2) - (AVATAR_SIZE / 2)),
                },
                { input: welcomeTextSvg },
                { input: userTextSvg },
            ])
            .jpeg()
            .toBuffer();
        
        return finalImage;

    } catch (error) {
        console.error('[WelcomeBanner] Failed to generate image:', error);
        return null;
    }
}

module.exports = { createWelcomeBanner };