# Project PMU™ Discord Bot

A custom Discord bot built with Discord.js v14.

## Features

*   Responds with a <:PandaYay:1357806568535490812> emoji when mentioned (with a global cooldown).
*   DMs the configured owner when the bot comes online.
*   Sets a "Streaming" status with a custom message and link.
*   Structured for easy addition of new events and commands.

## Prerequisites

Before you begin, ensure you have the following installed:

*   [Node.js](https://nodejs.org/) (version 16.9.0 or higher recommended)
*   [npm](https://www.npmjs.com/) (Node Package Manager, typically comes with Node.js)
*   (Optional) [Git](https://git-scm.com/) for cloning the repository.

## Setup Instructions

1.  **Get the Code:**
    *   If you have Git installed, clone the repository:
        ```bash
        git clone <your-repository-url>
        cd projectpmu-discordbot
        ```
    *   Alternatively, download the source code as a ZIP file and extract it.

2.  **Install Dependencies:**
    Navigate to the project's root directory (`projectpmu-discordbot`) in your terminal and run:
    ```bash
    npm install
    ```
    This will install all necessary packages, including `discord.js` and `dotenv`.

## Running the Bot

You have two primary ways to run the bot:

1.  **Standard Mode (using Node):**
    This is the basic way to run the bot. Open your terminal in the project's root directory and execute:
    ```bash
    node src/index.js
    ```
    The bot should log in and print a confirmation message to the console, and the owner should receive a DM.

2.  **Development Mode (using Nodemon):**
    If you have `nodemon` installed (it's included as a dev dependency in the `package.json`), you can use it to automatically restart the bot whenever you save changes to project files. This is highly recommended for development.
    In the project's root directory, run:
    ```bash
    npm run dev
    ```
    This command is a script defined in your `package.json` which executes `nodemon src/index.js`.

    To stop the bot, press `CTRL+C` in the terminal where it's running.
---