const puppeteer = require('puppeteer');

(async () => {
  console.log('⬇️ Téléchargement automatique de Chromium via Puppeteer...');
  const browser = await puppeteer.launch({ headless: 'new' });
  await browser.close();
})();
