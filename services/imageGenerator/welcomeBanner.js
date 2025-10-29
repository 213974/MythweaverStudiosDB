// services/imageGenerator/welcomeBanner.js
const sharp = require('sharp');
const axios = require('axios');

// --- Image & Layout Constants ---
const BACKGROUND_IMAGE_URL = 'https://i.pinimg.com/1200x/7c/dd/a0/7cdda0f55609c37bd94b93f215d763ba.jpg';
const IMAGE_WIDTH = 1199;
const IMAGE_HEIGHT = 672;

// --- Avatar Constants ---
const AVATAR_SIZE = 256;
const AVATAR_TOP_Y = 58;
const BORDER_THICKNESS = 6; // Thickness of the new border in pixels
const BORDER_SIZE = AVATAR_SIZE + BORDER_THICKNESS * 2; // Diameter of the border circle

// --- Text Constants (Pixel-based for predictable layout) ---
const WELCOME_TEXT_Y = 445;
const USERNAME_TEXT_Y = 515;
// Use a generic font family. This tells the SVG renderer to use its default
// sans-serif font, which is the most reliable way to ensure text renders
// on any system, preventing the '***' issue.
const FONT_FAMILY = 'sans-serif';

/**
 * Escapes special XML characters to prevent issues when injecting text into SVG.
 * @param {string} text The text to sanitize.
 * @returns {string} The sanitized text.
 */
function sanitizeText(text) {
    return text.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;')
               .replace(/'/g, '&apos;');
}

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
            .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
            .composite([{
                input: circleMask,
                blend: 'dest-in'
            }])
            .png()
            .toBuffer();

        // --- 3. Create the glowing border ---
        const borderSvg = Buffer.from(`
            <svg width="${BORDER_SIZE}" height="${BORDER_SIZE}">
                <defs>
                    <filter id="glow_gold">
                        <feDropShadow dx="0" dy="0" stdDeviation="3.5" flood-color="#FFD700"/>
                    </filter>
                </defs>
                <circle
                    cx="${BORDER_SIZE / 2}"
                    cy="${BORDER_SIZE / 2}"
                    r="${AVATAR_SIZE / 2}"
                    fill="none"
                    stroke="white"
                    stroke-width="${BORDER_THICKNESS}"
                    filter="url(#glow_gold)"
                />
            </svg>
        `);

        // --- 4. Create text overlays with neon glow effect ---
        const sanitizedUsername = sanitizeText(username.toUpperCase());

        const welcomeTextSvg = Buffer.from(`
            <svg width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}">
                <defs>
                    <filter id="glow_white">
                        <feDropShadow dx="0" dy="0" stdDeviation="4.5" flood-color="white"/>
                    </filter>
                </defs>
                <style>
                    .title { fill: white; font-size: 100px; font-weight: bold; font-family: ${FONT_FAMILY}; }
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
                    .subtitle { fill: white; font-size: 48px; font-weight: bold; font-family: ${FONT_FAMILY}; }
                </style>
                <text x="50%" y="${USERNAME_TEXT_Y}" text-anchor="middle" class="subtitle" filter="url(#glow_white_sub)">${sanitizedUsername}</text>
            </svg>
        `);

        // --- 5. Composite all layers ---
        const finalImage = await sharp(backgroundBuffer)
            .composite([
                {
                    input: borderSvg,
                    top: AVATAR_TOP_Y - BORDER_THICKNESS,
                    left: Math.round((IMAGE_WIDTH / 2) - (BORDER_SIZE / 2)),
                },
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