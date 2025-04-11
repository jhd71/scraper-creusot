const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeCreusotInfos() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // 1) User-Agent réaliste
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/101.0.4951.64 Safari/537.36');

  const listingUrl = 'https://www.creusot-infos.com/news/faits-divers/';
  
  // 2) Charger la page plus longtemps
  await page.goto(listingUrl, {
    waitUntil: 'networkidle2',
    timeout: 60000 
  });

  // 10 secondes de plus pour être sûr
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  // 3) Sauvegarde du HTML dans debug_listing.html
  const content = await page.content();
  await fs.promises.writeFile('debug_listing.html', content);
  console.log("Contenu du listing sauvegardé dans debug_listing.html");

  // Essayer de récupérer .newsListItem
  const articles = await page.evaluate(() => {
    const results = [];
    const items = document.querySelectorAll('.newsListItem');
    items.forEach(item => {
      const titleEl = item.querySelector('.newsListTitle');
      const dateEl = item.querySelector('.newsListPubli');
      const resumeEl = item.querySelector('.newsListResume');
      const linkEl = item.querySelector('a');
      const imageEl = item.querySelector('img');

      const title = titleEl ? titleEl.textContent.trim() : '';
      const link = linkEl ? linkEl.href : '';
      const image = imageEl ? imageEl.src : '';
      const dateText = dateEl ? dateEl.textContent.trim() : '';
      const resume = resumeEl ? resumeEl.textContent.trim() : '';
      
      // Conversion date
      let isoDate = '';
      if (dateText) {
        const parts = dateText.split(' ');
        if (parts.length === 2) {
          const dateParts = parts[0].split('/');
          if (dateParts.length === 3) {
            isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T${parts[1]}:00`;
          }
        }
      }

      if (title && link && image && isoDate && resume) {
        results.push({
          title,
          link,
          image,
          date: isoDate,
          summary: resume,
          source: 'Creusot Infos'
        });
      }
    });
    return results;
  });

  console.log(`Nombre d'articles récupérés: ${articles.length}`);
  
  await fs.promises.writeFile('data/articles.json', JSON.stringify(articles, null, 2));
  await browser.close();
  console.log("✅ Scraping terminé.");
}

scrapeCreusotInfos().then(() => {
  console.log("✅ Processus terminé.");
});
