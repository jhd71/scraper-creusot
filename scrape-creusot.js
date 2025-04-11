const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeCreusotInfos() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  const listingUrl = 'https://www.creusot-infos.com/news/faits-divers/';
  
  // Charger la page de listing
  await page.goto(listingUrl, {
    waitUntil: 'networkidle2',
    timeout: 30000
  });
  
  // Optionnel : Sauvegarder le contenu pour inspection
  // const listingContent = await page.content();
  // await fs.promises.writeFile('debug_listing.html', listingContent);

  // Adapter ce sélecteur en fonction de la structure réelle de la page de listing
  const articleLinks = await page.evaluate(() => {
    const links = [];
    // Par exemple, si les articles sont dans des div avec la classe "newsBlock"
    const items = document.querySelectorAll('.newsBlock');
    items.forEach(item => {
      const linkEl = item.querySelector('a');
      if (linkEl && linkEl.href) {
        links.push(linkEl.href);
      }
    });
    return links;
  });
  
  console.log(`Nombre d'articles trouvés : ${articleLinks.length}`);
  
  if (!articleLinks.length) {
    console.error("Aucun lien d'article n'a été trouvé sur le listing.");
    await browser.close();
    return;
  }
  
  // Limiter par exemple aux 5 premiers articles
  const linksToScrape = articleLinks.slice(0, 5);
  const results = [];
  
  // Pour chaque lien, ouvrir la page d'article et extraire les données
  for (const url of linksToScrape) {
    const articlePage = await browser.newPage();
    try {
      await articlePage.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      // Attendre quelques secondes si nécessaire (puisque le contenu peut être chargé dynamiquement)
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      await articlePage.waitForSelector('div.newsFullPubli', { timeout: 30000 });
      const articleData = await articlePage.evaluate(() => {
        // Sélecteurs pour extraire les données
        const titleEl = document.querySelector('.newsFullTitle');
        const imageEl = document.querySelector('img.newsFullImg');
        const dateEl = document.querySelector('div.newsFullPubli');
        const canonicalLink = document.querySelector('link[rel="canonical"]');
        const link = canonicalLink ? canonicalLink.href : document.location.href;
        
        const title = titleEl ? titleEl.textContent.trim() : '';
        const image = imageEl ? imageEl.src : '';
        const dateText = dateEl ? dateEl.textContent.trim() : '';
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
        return {
          title,
          link,
          image,
          date: isoDate,
          source: 'Creusot Infos'
        };
      });
      
      if (articleData.title && articleData.date) {
        results.push(articleData);
      } else {
        console.warn("Données incomplètes pour l'article :", url);
      }
      await articlePage.close();
    } catch (err) {
      console.error(`Erreur lors de l'extraction pour ${url}:`, err);
      await articlePage.close();
    }
  }
  
  await fs.promises.writeFile('data/articles.json', JSON.stringify(results, null, 2));
  await browser.close();
  console.log("✅ Scraping terminé. Articles extraits :", results.length);
}

scrapeCreusotInfos().then(() => {
  console.log("✅ Processus terminé.");
});
