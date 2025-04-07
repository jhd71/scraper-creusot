const puppeteer = require('puppeteer');

(async () => {
  console.log("⬇️ Téléchargement automatique de Chromium via Puppeteer...");
  await puppeteer.launch();
})();
