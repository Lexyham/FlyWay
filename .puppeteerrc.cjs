const { join } = require('path');
// Keep Chrome inside the project so it survives from Render's build step to runtime.
module.exports = {
  cacheDirectory: process.env.PUPPETEER_CACHE_DIR || join(__dirname, '.cache', 'puppeteer'),
};
