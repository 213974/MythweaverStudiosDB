# Mythweaver Studios™ Discord Bot

[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)

A custom Discord bot built with Discord.js v14, featuring a comprehensive, single-server clan system designed for community engagement.

This bot provides a full suite of commands for administrators to create and manage clans, and for clan leaders to manage their members, customize their identity, and maintain their roster.

## Core Features

*   **Advanced Clan System:**
    *   Admins can create clans, assign owners, and manage clan existence.
    *   Clan owners can set a clan motto and change their role color.
    *   Clan leadership can invite, kick, and manage member authority.
    *   Members can view detailed clan profiles and leave their clan.
*   **Robust Database:** Uses a SQLite database for fast, reliable, and scalable data storage, managed by `better-sqlite3`.
*   **Production Ready:** Includes configuration for PM2, a professional process manager to ensure the bot stays online 24/7.
*   **Structured and Extendable:** Built with a clean handler structure for adding new commands and events easily.

## Prerequisites

*   [Node.js](https://nodejs.org/) (v16.9.0 or higher)
*   [npm](https://www.npmjs.com/) (included with Node.js)
*   [Git](https://git-scm.com/) (for cloning)
*   [PM2](https://pm2.keymetrics.io/) (for production hosting)

## Setup Instructions

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/213974/MythweaverStudiosDB.git
    cd MythweaverStudiosDB
    ```

2.  **Install Dependencies:**
    This will install `discord.js`, `better-sqlite3`, and other necessary packages.
    ```bash
    npm install
    ```

3.  **Install PM2 Globally:**
    PM2 is used to keep the bot running continuously in a production environment.
    ```bash
    npm install pm2 -g
    ```

4.  **Configuration:**
    *   Create a `.env` file in the root directory and add your Discord bot token:
        ```env
        DISCORD_TOKEN=YOUR_BOT_TOKEN_HERE
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

5.  **Enable Discord Intents:**
    In your [Discord Developer Portal](https://discord.com/developers/applications), navigate to your bot's application page. Under the "Bot" tab, enable the following **Privileged Gateway Intents**:
    *   `SERVER MEMBERS INTENT`
    *   `MESSAGE CONTENT INTENT`

6.  **Database Migration (First-Time Setup Only):**
    If you have existing clan data in `data/clans.json`, this one-time script will migrate it to the new SQLite database. If you are starting fresh, this step will simply create the empty database file.
    ```bash
    node utils/migrate.js
    ```

## Running the Bot

You have two primary ways to run the bot, depending on your needs.

### Development Mode
Use this mode when you are actively writing code. It runs the bot in your current terminal and uses `nodemon` to automatically restart when you save a file.

```bash
npm run dev
```
To stop the bot, press `CTRL+C`.

### Production Mode with PM2
Use this mode to run the bot 24/7 on a server. It runs as a background process and will automatically restart if it crashes.

*   **Start the bot:**
    ```bash
    pm2 start ecosystem.config.js
    ```
*   **View live console logs:**
    ```bash
    pm2 logs MythweaverBot
    ```
*   **Monitor CPU and Memory usage:**
    ```bash
    pm2 monit
    ```
*   **Restart the bot (to apply major code changes):**
    ```bash
    pm2 restart MythweaverBot
    ```
*   **Stop the bot:**
    ```bash
    pm2 stop MythweaverBot
    ```
*   **Enable on Server Boot (Highly Recommended):**
    This ensures PM2 starts automatically if your server reboots.
    ```bash
    pm2 startup
    # PM2 will give you a command to run. Copy and paste it.
    pm2 save
    ```

## Command List

### Admin Commands
*Permissions: Bot Owner or `serverAdminRoleID`*

*   `/admin-add-clan <clanrole> <clanowner>`: Establishes a role as a new clan and sets its owner.
*   `/admin-clan-remove <clanrole> [reason]`: Deletes a clan from the system and DMs the owner. The role itself is not deleted.
*   `/admin-change-clan-owner <clanrole> <newowner>`: Transfers ownership of a clan to a new user.
*   `/reload`: Hot-reloads all slash commands for minor updates without a full restart.

### Clan Commands

#### Clan Management (Leadership Roles)
*   `/clan invite <user> <authority>`: Sends a public invitation for a user to join the clan. (Owner/Vice Only)
*   `/clan authority <user> <authority>`: Promotes or demotes an existing clan member. (Owner/Vice Only)
*   `/clan kick <user> [reason]`: Kicks a member from the clan. (Owner/Vice/Officer)

#### Customization (Owner Only)
*   `/clan motto [motto]`: Sets or removes the clan's motto.
*   `/clan color <hexcolor>`: Changes the clan's role color (e.g., `#A737FF`).

#### General Clan Actions
*   `/clan leave`: Allows a member to leave their current clan. Owners cannot use this.
*   `/clan view [clanrole]`: Displays a detailed profile of a clan. Shows your own clan if no role is specified.

## License

This project is licensed under a proprietary license. Please see the [LICENSE](LICENSE) file for details. You may view the code for educational purposes, but you are not permitted to use, copy, or distribute it without explicit written permission from the copyright holder.

## Contributing

As this is a proprietary project, contributions are not being accepted at this time.