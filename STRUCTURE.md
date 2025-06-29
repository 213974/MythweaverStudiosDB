# Bot Architecture & Structure

This document provides a high-level overview of the bot's architecture, directory structure, and data flow. It is intended to be the primary reference for any current or future developers.

## Core Philosophy

The bot is designed with a modular and separated architecture. The key principles are:
- **Separation of Concerns:** Logic is separated based on its purpose. Command definitions are separate from database logic, which is separate from interaction handling.
- **Centralized Logic:** Reusable logic is placed in "manager" utilities (`clanManager.js`, `economyManager.js`) to avoid code duplication and ensure a single source of truth for business rules.
- **Scalability:** The structure is designed to easily accommodate new features (commands, events, systems) without requiring major refactors of core files.

---

## Directory Structure

The project is organized into the following key directories:

| Path | Purpose |
| :--- | :--- |
| **`/commands`** | Contains all slash command definitions. It is further divided by category (`admin`, `economy`, `player`, `utility`) for organization. Each file represents a single user-facing command. |
| **`/data`** | Stores persistent data. Currently holds the `database.db` file. This directory is included in `.gitignore` and should never be committed to the repository. |
| **`/events`** | Contains handlers for Discord Gateway events (e.g., `ready`, `interactionCreate`). These are the primary entry points for the bot to react to Discord's API. |
| **`/handlers`** | Contains the logic for processing different *types* of interactions. This keeps `interactionCreate.js` clean by acting as a smart router. |
| **`/src`** | The main source directory. It contains the bot's entry point (`index.js`) and primary configuration (`config.js`). |
| **`/utils`** | Contains all the "backend" logic and shared utilities. This is the bot's brain. It includes the database connection (`database.js`) and all the manager files. |
| **(Root)** | The root directory contains project-wide configuration and scripts like `package.json`, `.env`, `deploy-commands.js`, and `ecosystem.config.js`. |

---

## System Data Flow

Understanding how an interaction flows through the system is key to debugging and development.

### Example 1: User runs a Slash Command (e.g., `/bank view`)

1.  **User Input:** The user types `/bank view` in Discord.
2.  **Discord API:** Sends an `INTERACTION_CREATE` event to the bot.
3.  **`events/interactionCreate.js`**: Receives the event. It identifies it as a `ChatInputCommand` and passes it to the `chatInputCommandHandler`.
4.  **`handlers/chatInputCommandHandler.js`**: Looks up the command name (`bank`) in the `client.commands` collection and calls its `.execute()` method. It also enforces the command cooldown.
5.  **`commands/economy/bank.js`**: The `execute()` function runs. It determines the subcommand (`view`), gets the user's ID, and calls the appropriate function in the economy manager.
6.  **`utils/economyManager.js`**: The `getWallet()` function is called. It prepares and executes a SQL query.
7.  **`utils/database.js`**: The `better-sqlite3` library interacts with the `database.db` file, retrieves the data, and returns it.
8.  **Response:** The flow returns to `bank.js`, which uses the data to build an `EmbedBuilder` and replies to the interaction.

### Example 2: User clicks a Button (e.g., "Upgrade Bank")

1.  **User Input:** The user clicks the "Upgrade Bank" button on the `/bank view` message.
2.  **Discord API:** Sends an `INTERACTION_CREATE` event.
3.  **`events/interactionCreate.js`**: Receives the event. It identifies it as a `ButtonInteraction` and sees the `customId` starts with `upgrade_`. It passes the interaction to the `buttonHandler`.
4.  **`handlers/buttonHandler.js`**: The main function routes the interaction to the specific `handleUpgradeButton` function. This function builds a new confirmation embed and presents the "Confirm Upgrade" and "Cancel" buttons by calling `.update()` on the interaction.
5.  **The flow pauses** until the user clicks "Confirm Upgrade."
6.  **`events/interactionCreate.js`**: A new `ButtonInteraction` is received. It sees the ID `upgrade_bank_confirm_...` and routes it to the correct handler.
7.  **`handlers/buttonHandler.js`**: The `handleUpgradeButton` function processes the confirmation, calls `economyManager.upgradeBankTier()`, builds the final success/failure embed, and updates the message.