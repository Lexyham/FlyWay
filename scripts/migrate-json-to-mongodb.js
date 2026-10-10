#!/usr/bin/env node

const path = require('path');
const { migrateJsonToMongo } = require('../services/mongoService');

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required. Add it to your .env or Render environment before running the migration.');
  }

  const dataDir = path.join(__dirname, '..', 'data');
  const summary = await migrateJsonToMongo(dataDir);
  console.log('Mongo migration complete. Imported collections:', JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error('Mongo migration failed:', err.message);
  process.exit(1);
});
