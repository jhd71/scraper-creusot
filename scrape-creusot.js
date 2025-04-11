const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeCreusotInfos() {
  // Lancer le navigateur dans un environnement headless adapté pour GitHub Actions
  const browser = await puppeteer.launch({
    headless: true, // Vous pouvez utiliser 'new' selon la version, ici on simplifie
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Aller directement sur une page d'article complet
  const articleUrl = 'https://www.creusot-infos.com/news/faits-divers/en-bourgogne-et-ailleurs/suisse-des-coups-de-feu-entendus-avant-l-incendie-d-une-maison.html';
  await page.goto(articleUrl, {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  // Ajouter une attente manuelle (au cas où le contenu se chargerait avec du délai)
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Attendre que l'élément contenant la date soit présent
  try {
    await page.waitForSelector('div.newsFullPubli', { timeout: 30000 });
  } catch (err) {
    console.error("L'élément 'div.newsFullPubli' n'a pas été trouvé.");
    // Sauvegarder le HTML pour debug
    const content = await page.content();
    await fs.promises.writeFile('debug.html', content);
    await browser.close();
    return;
  }

  // Extraction des informations de l'article dans le contexte de la page
  const article = await page.evaluate(() => {
    // Sélectionner l'élément de date
    const dateEl = document.querySelector('div.newsFullPubli');
    const titleEl = document.querySelector('.newsFullTitle');
    const imageEl = document.querySelector('img.newsFullImg');
    // Récupérer l'URL canonique si disponible, sinon prendre l'URL de la page
    const canonicalLink = document.querySelector('link[rel="canonical"]');
    const link = canonicalLink ? canonicalLink.href : document.location.href;
    
    const title = titleEl ? titleEl.textContent.trim() : '';
    const image = imageEl ? imageEl.src : '';
    const dateText = dateEl ? dateEl.textContent.trim() : '';

    let isoDate = '';
    if (dateText) {
      // Le format attendu est "DD/MM/YYYY HH:mm" (ex. "10/04/2025 16:26")
      const parts = dateText.split(' ');
      if (parts.length === 2) {
        const dateParts = parts[0].split('/');
        if (dateParts.length === 3) {
          // Construit la date en format ISO "YYYY-MM-DDTHH:mm:00"
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

  // Sauvegarder l'article dans le fichier JSON
  await fs.promises.writeFile('data/articles.json', JSON.stringify([article], null, 2));
  await browser.close();
  console.log("✅ Scraping terminé.");
}

scrapeCreusotInfos().then(() => {
  console.log("Processus terminé.");
});
