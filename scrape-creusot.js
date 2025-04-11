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
  const results = [];
  // Adaptez ce sélecteur en fonction de la structure réelle des articles.
  // Ici, on suppose que chaque article est contenu dans un <article> ou un élément équivalent.
  const articleElements = document.querySelectorAll('article');
  
  for (const articleEl of articleElements) {
    const linkEl = articleEl.querySelector('a');
    const title = linkEl ? linkEl.textContent.trim() : '';
    const href = linkEl ? linkEl.href : '';
    
    const imageEl = articleEl.querySelector('img');
    const image = imageEl ? imageEl.src : '';
    
    // Extraire la date réelle depuis l'élément
    const dateEl = articleEl.querySelector('.newsFullPubli');
    const dateText = dateEl ? dateEl.textContent.trim() : '';
    
    let isoDate = '';
    if (dateText) {
      // On suppose que le format est "DD/MM/YYYY HH:mm"
      const parts = dateText.split(' ');
      if (parts.length === 2) {
        const dateParts = parts[0].split('/');
        if (dateParts.length === 3) {
          // Construire la date ISO : "YYYY-MM-DDTHH:mm:00"
          isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T${parts[1]}:00`;
        }
      }
    }
    
    // Vérification : si isoDate n'est pas vide et que le titre est suffisamment long, on ajoute l'article.
    if (title && href && image && title.length > 10 && isoDate) {
      results.push({
        title,
        link: href,
        image,
        date: isoDate,
        source: 'Creusot Infos'
      });
    }
    
    if (results.length >= 5) break;
  }
  
  return results;
});

  await fs.promises.writeFile('data/articles.json', JSON.stringify(articles, null, 2));
  await browser.close();
}

scrapeCreusotInfos().then(() => {
  console.log("✅ Scraping terminé.");
});
