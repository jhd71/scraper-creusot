const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeCreusotInfos() {
  // Lance le navigateur en mode headless avec les options adaptées pour un environnement CI/CD
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

  // Extraction des articles
  const articles = await page.evaluate(() => {
    const results = [];
    // Adaptez ce sélecteur à la structure réelle de la page.
    // Ici on suppose que chaque article est contenu dans un élément avec la classe 'news-item'
    const articleElements = document.querySelectorAll('.news-item');
    
    for (const articleEl of articleElements) {
      // Sélection du lien qui contient le titre et l'URL
      const linkEl = articleEl.querySelector('a');
      const title = linkEl ? linkEl.textContent.trim() : '';
      const href = linkEl ? linkEl.href : '';
      
      // Récupération de l'image associée
      const imageEl = articleEl.querySelector('img');
      const image = imageEl ? imageEl.src : '';
      
      // Extraction de la date à partir de l'élément qui la contient
      const dateEl = articleEl.querySelector('.newsFullPubli');
      const dateText = dateEl ? dateEl.textContent.trim() : '';
      
      // Conversion de la date du format "DD/MM/YYYY HH:MM" en ISO
      let isoDate = '';
      if (dateText) {
        // Exemple : "10/04/2025 20:00" → "2025-04-10T20:00:00"
        const parts = dateText.split(' '); // sépare la date et l'heure
        if (parts.length === 2) {
          const dateParts = parts[0].split('/');
          if (dateParts.length === 3) {
            isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T${parts[1]}:00`;
          }
        }
      }
      
      // Vérifie que le titre, le lien, l'image et une date ont bien été extraits
      if (title && href && image && title.length > 10 && isoDate) {
        results.push({
          title,
          link: href,
          image,
          date: isoDate,
          source: 'Creusot Infos'
        });
      }
      
      // Limite le nombre d'articles (ici 5)
      if (results.length >= 5) break;
    }
    
    return results;
  });

  // Écriture du résultat dans le fichier JSON
  await fs.promises.writeFile('data/articles.json', JSON.stringify(articles, null, 2));
  await browser.close();
}

scrapeCreusotInfos().then(() => {
  console.log("✅ Scraping terminé.");
});
