// install-chrome.js
const puppeteer = require('puppeteer');

(async () => {
  console.log('⬇️ Téléchargement de Chromium...');
  await puppeteer.launch().then(browser => browser.close());
  console.log('✅ Chromium téléchargé.');
})();
