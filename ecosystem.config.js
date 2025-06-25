module.exports = {
    apps: [{
        name: "MythweaverBot",
        script: "src/index.js",
        watch: false, // Don't watch files, nodemon is better for that
        max_memory_restart: '256M', // Restart if it uses more than 256MB of RAM
        env_production: {
            NODE_ENV: "production"
        },
    }]
}