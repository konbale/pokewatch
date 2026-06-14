/**
 * Run this ONCE to generate your VAPID keys for push notifications.
 * Copy the output into your Render.com environment variables.
 *
 * Usage: node generate-keys.js
 */
const webpush = require('web-push');
const keys = webpush.generateVAPIDKeys();
console.log('\n✅ Your VAPID Keys (copy these into Render.com environment variables):\n');
console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
console.log('\nAlso set:');
console.log('VAPID_EMAIL=mailto:your@email.com');
console.log('PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true  (Render provides Chrome)');
console.log('PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable');
console.log('');
