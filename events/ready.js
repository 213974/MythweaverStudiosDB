// events/ready.js
const { Events, ActivityType } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    //  eventClient: The client instance emitted by the 'ready' event.
    //  handlerClient: The client instance explicitly passed by our event handler.
    //                 For the 'ready' event, eventClient and handlerClient are the same object.
    //  appConfig: Our actual configuration object from src/config.js.
    async execute(eventClient, handlerClient, appConfig) {
        // Use appConfig for your application configuration
        // Use eventClient (or handlerClient, they are the same here) for Discord client operations

        // This debug line now correctly stringifies your actual configuration object
        console.log('[ready.js] Received config:', JSON.stringify(appConfig));

        console.log(`Ready! Logged in as ${eventClient.user.tag}`);
        console.log(`Bot is in ${eventClient.guilds.cache.size} servers.`);

        // Check if appConfig and appConfig.ownerID are defined before using them
        if (appConfig && appConfig.ownerID) {
            try {
                const owner = await eventClient.users.fetch(appConfig.ownerID);
                if (owner) {
                    await owner.send('Hello! I am online and ready to go!');
                    console.log(`Successfully DMed owner (${owner.tag}) that the bot is online.`);
                } else {
                    console.error(`Could not find user with ID: ${appConfig.ownerID}`);
                }
            } catch (error) {
                console.error(`Failed to DM owner (${appConfig.ownerID}):`, error);
            }
        } else {
            console.error('[ready.js] Error: appConfig.ownerID is undefined. Cannot DM owner.');
            if (!appConfig) console.error('[ready.js] appConfig object itself is undefined/null.');
            else console.error(`[ready.js] appConfig.ownerID value is: ${appConfig.ownerID}`);
        }

        eventClient.user.setPresence({
            activities: [{
                name: "Project PMU's Promise c:", // Or your desired status message
                type: ActivityType.Streaming,
                url: "https://youtu.be/qhvdg2D9d_o?si=olOBCuhgJ5CuGz-b"
            }],
            status: 'online',
        });
        // console.log(`Set bot activity to Streaming: "Project PMU's Success c:"`);
    },
};