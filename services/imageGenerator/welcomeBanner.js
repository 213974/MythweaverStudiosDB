// services/imageGenerator/welcomeBanner.js
const sharp = require('sharp');
const axios = require('axios');

const BACKGROUND_IMAGE_URL = 'https://i.pinimg.com/1200x/7c/dd/a0/7cdda0f55609c37bd94b93f215d763ba.jpg';
const AVATAR_SIZE = 256;
const IMAGE_WIDTH = 1199;
const IMAGE_HEIGHT = 672;

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

        // --- 3. Create text overlays as SVG ---
        // This method provides more control over text styling.
        const welcomeTextSvg = Buffer.from(`
            <svg width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}">
                <style>
                    .title { fill: #A9B2B7; font-size: 100px; font-weight: bold; font-family: sans-serif; }
                </style>
                <text x="50%" y="55%" text-anchor="middle" class="title">WELCOME</text>
            </svg>
        `);

        const userTextSvg = Buffer.from(`
            <svg width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}">
                 <style>
                    .subtitle { fill: #E53658; font-size: 48px; font-weight: bold; font-family: sans-serif; }
                </style>
                <text x="50%" y="65%" text-anchor="middle" class="subtitle">${username.toUpperCase()}</text>
            </svg>
        `);

        // --- 4. Composite all layers ---
        const finalImage = await sharp(backgroundBuffer)
            .composite([
                {
                    input: circularAvatar,
                    top: Math.round((IMAGE_HEIGHT / 2) - (AVATAR_SIZE / 2) - 100), // Position avatar
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