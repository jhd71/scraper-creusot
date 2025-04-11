const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeCreusotInfos() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('https://www.creusot-infos.com/news/faits-divers/', {
    waitUntil: 'networkidle2',  // Attendre que le contenu soit complètement chargé
    timeout: 20000
  });

  await page.waitForSelector('body', { timeout: 10000 });

  const articles = await page.evaluate(() => {
    const results = [];
    // Par exemple, si chaque article est contenu dans une balise <article>
    const articleElements = document.querySelectorAll('article');
    console.log("Nombre d'articles trouvés :", articleElements.length);
    
    for (const articleEl of articleElements) {
      // Sélection du lien contenant le titre et l'URL
      const linkEl = articleEl.querySelector('a');
      const title = linkEl ? linkEl.textContent.trim() : '';
      const href = linkEl ? linkEl.href : '';
      
      // Récupération de l'image associée
      const imageEl = articleEl.querySelector('img');
      const image = imageEl ? imageEl.src : '';
      
      // Extraction de la date depuis l'élément <div class="newsFullPubli">
      const dateEl = articleEl.querySelector('.newsFullPubli');
      const dateText = dateEl ? dateEl.textContent.trim() : '';
      
      // Conversion de la date du format "DD/MM/YYYY HH:MM" en ISO
      let isoDate = '';
      if (dateText) {
        const parts = dateText.split(' '); // Sépare la date et l'heure
        if (parts.length === 2) {
          const dateParts = parts[0].split('/');
          if (dateParts.length === 3) {
            isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T${parts[1]}:00`;
          }
        }
      }
      
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
