const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeCreusotInfos() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('https://www.creusot-infos.com/news/faits-divers/', {
    waitUntil: 'networkidle2', // Attendre que tout soit chargé
    timeout: 30000
  });

  // Si nécessaire, insérer une pause pour être sûr que la page s'affiche complètement
  await page.waitForTimeout(5000);

  try {
    await page.waitForSelector('div.newsFullPubli', { timeout: 20000 });
  } catch (err) {
    console.error("Erreur : L'élément avec la classe 'newsFullPubli' n'a pas été trouvé.");
    // Option : sauvegarder le contenu de la page pour debug
    const content = await page.content();
    await fs.promises.writeFile('debug.html', content);
    await browser.close();
    return;
  }

  const articles = await page.evaluate(() => {
    const results = [];
    
    // Adaptation : Si la page contient plusieurs articles, il faudra peut-être itérer sur un conteneur.
    // Ici, nous considérons que la page est une page d'article unique
    const titleEl = document.querySelector('.newsFullTitle');
    const imageEl = document.querySelector('.newsFullImg');
    const dateEl = document.querySelector('div.newsFullPubli');
    const canonicalLink = document.querySelector('link[rel="canonical"]');
    const link = canonicalLink ? canonicalLink.href : document.location.href;
    
    const title = titleEl ? titleEl.textContent.trim() : '';
    const image = imageEl ? imageEl.src : '';
    const dateText = dateEl ? dateEl.textContent.trim() : '';
    
    let isoDate = '';
    if (dateText) {
      // Conversion du format "DD/MM/YYYY HH:mm" en ISO
      const parts = dateText.split(' ');
      if (parts.length === 2) {
        const dateParts = parts[0].split('/');
        if (dateParts.length === 3) {
          isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T${parts[1]}:00`;
        }
      }
    }
    
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

  await fs.promises.writeFile('data/articles.json', JSON.stringify(articles, null, 2));
  await browser.close();
  console.log("✅ Scraping terminé.");
}

scrapeCreusotInfos().then(() => {
  console.log("✅ Processus terminé.");
});
