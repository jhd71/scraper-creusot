const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeCreusotInfos() {
  // Lance le navigateur avec les options pour un environnement CI (comme GitHub Actions)
  const browser = await puppeteer.launch({
    headless: 'new', // ou true selon votre version de Puppeteer
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Utilisez 'networkidle2' pour attendre que toute la page soit chargée
  await page.goto('https://www.creusot-infos.com/news/faits-divers/', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  // Attendre que l'élément de date soit présent dans le DOM
  await page.waitForSelector('.newsFullPubli', { timeout: 10000 });

  // Extraction des informations de l'article dans le contexte de la page
  const articles = await page.evaluate(() => {
    const results = [];

    // *** IMPORTANT ***  
    // Adaptez ce sélecteur selon la page :
    // Ici, nous partons du principe que la page affichant un article contient ces éléments
    const dateEl = document.querySelector('.newsFullPubli');
    const titleEl = document.querySelector('.newsFullTitle');
    const imageEl = document.querySelector('.newsFullImg');
    // On peut tenter de récupérer l'URL canonique ou utiliser document.location
    const canonicalLink = document.querySelector('link[rel="canonical"]');
    const link = canonicalLink ? canonicalLink.href : document.location.href;

    const title = titleEl ? titleEl.textContent.trim() : '';
    const image = imageEl ? imageEl.src : '';
    const dateText = dateEl ? dateEl.textContent.trim() : '';

    // Conversion de la date extraite (format "DD/MM/YYYY HH:mm") en format ISO
    let isoDate = '';
    if (dateText) {
      // Exemple de date extraite : "10/04/2025 16:26"
      const parts = dateText.split(' '); // ["10/04/2025", "16:26"]
      if (parts.length === 2) {
        const dateParts = parts[0].split('/'); // ["10", "04", "2025"]
        if (dateParts.length === 3) {
          isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T${parts[1]}:00`;
        }
      }
    }

    // Vérifie que toutes les données essentielles ont été récupérées
    if (title && link && image && isoDate && title.length > 10) {
      results.push({
        title,
        link,
        image,
        date: isoDate,
        source: 'Creusot Infos'
      });
    }

    return results;
  });

  // Écriture des résultats dans un fichier JSON
  await fs.promises.writeFile('data/articles.json', JSON.stringify(articles, null, 2));
  await browser.close();
}

scrapeCreusotInfos().then(() => {
  console.log("✅ Scraping terminé.");
});
