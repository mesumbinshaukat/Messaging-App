const https = require('https');

// Change this to your actual Render URL
const RENDER_URL = 'https://messaging-app-xlvj.onrender.com/health';

console.log(`Starting keep-alive for ${RENDER_URL}`);

setInterval(() => {
  https.get(RENDER_URL, (res) => {
    console.log(`[${new Date().toISOString()}] Keep-alive ping: ${res.statusCode}`);
  }).on('error', (err) => {
    console.error(`[${new Date().toISOString()}] Keep-alive error:`, err.message);
  });
}, 14 * 60 * 1000); // Every 14 minutes
