// Déclenchement test GitHub Actions
const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeCreusotInfos() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('https://www.creusot-infos.com/news/faits-divers/', {
    waitUntil: 'domcontentloaded',
    timeout: 20000
  });

  await page.waitForSelector('body', { timeout: 10000 });

  const articles = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    const results = [];

    for (const link of links) {
      const title = link.textContent?.trim();
      const href = link.href;
      const image = link.querySelector('img')?.src;

      if (title && href && image && title.length > 10) {
        results.push({
          title,
          link: href,
          image,
          date: new Date().toISOString(),
          source: 'Creusot Infos'
        });
      }

      if (results.length >= 5) break;
    }

    return results;
  });

  await fs.promises.writeFile('creusot.json', JSON.stringify(articles, null, 2));
  await browser.close();
}

scrapeCreusotInfos().then(() => {
  console.log("✅ Scraping terminé.");
});
