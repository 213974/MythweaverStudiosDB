# Mythweaver Studios™ Discord Bot

[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)

A custom Discord bot built with Discord.js v14, featuring a comprehensive, single-server clan system designed for community engagement.

This bot provides a full suite of commands for administrators to create and manage clans, and for clan leaders to manage their members, customize their identity, and maintain their roster.

## Core Features

*   **Advanced Clan System:**
    *   Admins can create clans, assign owners, and manage clan existence.
    *   Clan owners can set a clan motto and change their role color.
    *   Clan leadership (Owners/Vices) can invite, kick, and manage member authority.
    *   Members can view detailed clan profiles and leave their clan.
*   **Structured and Extendable:** Built with a clean handler structure for adding new commands and events easily.
*   **Interactive Presence:** Responds with a custom emoji when mentioned and DMs the bot owner on startup.
*   **Data Persistence:** Clan data is stored locally in `data/clans.json`, ensuring persistence between bot restarts. Temporary.

## Prerequisites

*   [Node.js](https://nodejs.org/) (v16.9.0 or higher)
*   [npm](https://www.npmjs.com/) (included with Node.js)
*   [Git](https://git-scm.com/) (for cloning)

## Setup Instructions

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/213974/ProjectPMU-Discordbot.git
    cd ProjectPMU-Discordbot
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Configuration:**
    *   Create a `.env` file in the root directory and add your bot token:
        ```env
        TOKEN=YOUR_DISCORD_BOT_TOKEN_HERE
        ```
    *   Edit `src/config.js` to set your server and user IDs:
        ```javascript
        // src/config.js
        module.exports = {
            ownerID: 'YOUR_DISCORD_USER_ID',
            serverAdminRoleID: 'YOUR_SERVER_ADMIN_ROLE_ID',
            guildID: 'YOUR_DISCORD_SERVER_ID',
        };
        ```

4.  **Enable Discord Intents:**
    In your [Discord Developer Portal](https://discord.com/developers/applications), navigate to your bot's application page. Under the "Bot" tab, enable the following **Privileged Gateway Intents**:
    *   `SERVER MEMBERS INTENT`
    *   `MESSAGE CONTENT INTENT`

## Running the Bot

*   **For development (recommended):**
    This command uses `nodemon` to automatically restart the bot on file changes.
    ```bash
    npm run dev
    ```

*   **For production:**
    ```bash
    node src/index.js
    ```

To stop the bot, press `CTRL+C` in the terminal.

## Command List

### Admin Commands
*Permissions: Bot Owner or `serverAdminRoleID`*

*   `/admin-add-clan <clanrole> <clanowner>`: Establishes a role as a new clan and sets its owner.
*   `/admin-clan-remove <clanrole> [reason]`: Deletes a clan from the system and DMs the owner. The role itself is not deleted.
*   `/admin-change-clan-owner <clanrole> <newowner>`: Transfers ownership of a clan to a new user.
*   `/reload`: Hot-reloads all slash commands and events without a full bot restart.

### Clan Commands

#### Clan Management (Owner/Vice Only)
*   `/clan invite <user> <authority>`: Sends a public invitation in the channel for a user to join the clan as a `Member` or `Officer`.
*   `/clan authority <user> <authority>`: Promotes or demotes an existing member within the clan. Owners can manage Vices; Vices can manage Officers/Members.
*   `/clan kick <user> [reason]`: Kicks a member from the clan and DMs them the reason.

#### Customization (Owner Only)
*   `/clan motto [motto]`: Sets or removes the clan's motto, which is displayed in `/clan view`.
*   `/clan color <hexcolor>`: Changes the clan's role color (e.g., `#A737FF`).

#### General Clan Actions
*   `/clan leave`: Allows a member to leave their current clan. Owners cannot leave.
*   `/clan view [clanrole]`: Displays a detailed public profile of a clan, including its motto, owner, leadership, and members. If no role is specified, it shows the user's own clan.

## License

This project is licensed under a proprietary license. Please see the [LICENSE](LICENSE) file for details. You may view the code for educational purposes, but you are not permitted to use, copy, or distribute it without explicit written permission from the copyright holder.

## Contributing

As this is a proprietary project, contributions are not being accepted at this time.

# Last updated: June 2025