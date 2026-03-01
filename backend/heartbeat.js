const axios = require('axios');

// Render's free tier sleeps after 15 mins of inactivity.
// We ping every 14 mins to keep the instance warm.
const BASE_URL = process.env.RENDER_EXTERNAL_URL || 'https://supika-backend.onrender.com';
const RENDER_URL = `${BASE_URL}/health`;
const INTERVAL = 14 * 60 * 1000;

console.log(`--- Supika Heartbeat Service Started ---`);
console.log(`Target: ${RENDER_URL}`);
console.log(`Interval: Every 14 minutes`);

async function pulse() {
    try {
        const startTime = Date.now();
        const response = await axios.get(RENDER_URL);
        const duration = Date.now() - startTime;

        console.log(`[${new Date().toLocaleTimeString()}] ❤️ Heartbeat successful! Status: ${response.status} (${duration}ms)`);
    } catch (error) {
        console.error(`[${new Date().toLocaleTimeString()}] ⚠️ Heartbeat failed: ${error.message}`);

        // If it's a 404/500 it still "wakes" the server, but log it anyway
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
        }
    }
}

// Initial pulse
pulse();

// Schedule repeated pulses
setInterval(pulse, INTERVAL);
