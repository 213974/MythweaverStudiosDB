@echo off
REM Navigates to the script's directory before running Docker commands.
cd /d "%~dp0"

echo ######################################
echo #                                    #
echo #      STARTING MYTHWEAVER BOT       #
echo #                                    #
echo ######################################
echo.
echo Closing this window will STOP the bot.
echo.

REM Build the image if needed and start the container in the foreground.
docker compose up --build