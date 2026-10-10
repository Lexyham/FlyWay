#!/usr/bin/env node
// Usage:  node scripts/check-services.js [you@example.com]
// Tests MongoDB Atlas and Brevo with the same env vars the server uses and prints the exact problem.
require('dotenv').config();
const mongo = require('../services/mongoService');
const brevo = require('../services/brevoMailService');

(async () => {
  let failed = false;

  console.log('\n== MongoDB ==');
  console.log('status:', JSON.stringify(mongo.getStorageStatus()));
  if (!mongo.isMongoEnabled()) {
    console.log('SKIPPED: set MONGODB_URI and USE_MONGODB=true (or NODE_ENV=production).');
  } else {
    try {
      const { summary } = await mongo.initStorage();
      console.log('OK. Documents per collection:', JSON.stringify(summary));
      await mongo.close();
    } catch (e) { failed = true; console.log('FAIL:', e.message); }
  }

  console.log('\n== Brevo ==');
  console.log('transport:', brevo.getTransport() || 'none', '| from:', brevo.getConfig().fromEmail || '(unset)');
  try {
    console.log('connection:', JSON.stringify(await brevo.testConnection()));
    const to = process.argv[2];
    if (to) {
      const r = await brevo.sendEmail({ to, subject: 'FlyWay Brevo test', textBody: 'Brevo is working.', htmlBody: '<p>Brevo is working.</p>' });
      console.log('test email:', JSON.stringify(r), '→ check the inbox/spam of', to);
    } else {
      console.log('(pass an address to also send a test email)');
    }
  } catch (e) { failed = true; console.log('FAIL:', e.message); }

  process.exit(failed ? 1 : 0);
})();
