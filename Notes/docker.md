# Docker Management Guide for MythweaverBot

This guide provides all the necessary commands and workflows for managing the MythweaverBot Discord bot using Docker.

## 1. Initial Setup & First Run

To build the bot's Docker image and run it for the first time, open a terminal in the project's root directory and execute:

```bash
docker compose up --build -d
```

*   `up`: Creates and starts the container.
*   `--build`: Forces Docker to build the image from the `Dockerfile` before starting.
*   `-d`: "Detached mode." Runs the container in the background so you can close the terminal.

Your bot is now running inside a Docker container.

---

## 2. Day-to-Day Management

These are the commands you will use most often.

### Checking Bot Logs

To see the live console output of your bot, which is essential for debugging:

```bash
docker compose logs -f
```

Press `Ctrl+C` to stop viewing the logs. The container will continue to run in the background.

### Checking Container Status

To see if the bot's container is running and healthy:

```bash
docker compose ps
```

You should see an output showing the `mythweaver-bot` service with a status of `running` or `up`.

### Stopping the Bot

To completely stop and remove the running container:

```bash
docker compose down
```

**Note:** Your SQLite database in the `/data` folder is completely safe. It is stored on your computer (the "host") and will be re-connected the next time you start the bot.

### Restarting the Bot

If you need to quickly restart the bot without any code changes:

```bash
docker compose restart
```

---

## 3. How to Update the Bot's Code

This is the standard workflow for deploying new code for your bot.

1.  **Make your code changes** in your editor (e.g., VS Code) and save the files as you normally would.
2.  **Open your terminal** in the project's root directory.
3.  **Run the `up --build` command again:**

    ```bash
    docker compose up --build -d
    ```

**What this command does:**
*   It notices that your source code files have changed.
*   It rebuilds the Docker image, packaging your new code inside it.
*   It gracefully stops the old container and starts a new, updated one in its place.
*   The entire process is seamless, with only a few seconds of downtime for the bot.

## 4. Advanced Commands

### Accessing the Container's Shell

If you need to debug something *inside* the running container, you can open a command prompt within it:

```bash
docker compose exec mythweaver-bot sh
```

This will give you a command line inside the container's environment. You can use `ls -la` to inspect files, for example. Type `exit` to leave.

### Cleaning Up Old Images

Over time, building new images will leave old, unused ones on your system. To clean them up and save disk space, you can run:

```bash
docker system prune
```

This will remove all unused images, networks, and build cache.