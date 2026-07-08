require('dotenv').config();
const { loginAndScrape } = require('./scraper');

(async () => {
  const result = await loginAndScrape(
    process.env.TEST_USERNAME,
    process.env.TEST_PASSWORD
  );
  console.log('=== HASIL SCRAPER ===');
  console.log(JSON.stringify(result, null, 2));
})();