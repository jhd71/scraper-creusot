const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeCreusotInfos() {
  const browser = await puppeteer.launch({
    headless: true, // pour GitHub Actions
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const listingUrl = 'https://www.creusot-infos.com/news/faits-divers/';
  await page.goto(listingUrl, {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  // Optionnel : attendre un peu pour s'assurer que le contenu s'affiche (si chargé dynamiquement)
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Pour déboguer, vous pouvez sauvegarder le HTML du listing
  // const content = await page.content();
  // await fs.promises.writeFile('debug_listing.html', content);

  // Extraction des données de chaque article à partir des éléments spécifiques
  const articles = await page.evaluate(() => {
    const results = [];
    // Sélectionner tous les éléments qui contiennent le titre de l'article
    const titleElements = Array.from(document.querySelectorAll('.newsListTitle'));
    
    titleElements.forEach(titleEl => {
      // Essayez de trouver un conteneur parent commun (par exemple, un élément englobant l'article)
      // Adaptez ce sélecteur si la structure HTML du listing a un conteneur dédié (ex: ".newsListItem")
      let container = titleEl.closest('.newsListItem');
      if (!container) {
        container = titleEl.parentElement;
      }
      
      // Titre et lien
      const title = titleEl.textContent.trim();
      const linkEl = container.querySelector('a');
      const link = linkEl ? linkEl.href : document.location.href;
      
      // Image (si présente dans le conteneur)
      const imageEl = container.querySelector('img');
      const image = imageEl ? imageEl.src : '';
      
      // Date depuis l'élément avec la classe "newsListPubli"
      const dateEl = container.querySelector('.newsListPubli');
      const dateText = dateEl ? dateEl.textContent.trim() : '';
      let isoDate = '';
      if (dateText) {
        // Supposé au format "DD/MM/YYYY HH:mm" par exemple "10/04/2025 16:26"
        const parts = dateText.split(' ');
        if (parts.length === 2) {
          const dateParts = parts[0].split('/');
          if (dateParts.length === 3) {
            isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T${parts[1]}:00`;
          }
        }
      }
      
      // Résumé de l'article
      const resumeEl = container.querySelector('.newsListResume');
      const summary = resumeEl ? resumeEl.textContent.trim() : '';
      
      // On n'ajoute l'article que si toutes les informations essentielles sont présentes
      if (title && link && image && isoDate && summary && title.length > 10) {
        results.push({
          title,
          link,
          image,
          date: isoDate,
          summary,
          source: 'Creusot Infos'
        });
      }
    });
    
    return results;
  });

  console.log(`Nombre d'articles récupérés : ${articles.length}`);

  await fs.promises.writeFile('data/articles.json', JSON.stringify(articles, null, 2));
  await browser.close();
  console.log("✅ Scraping terminé.");
}

scrapeCreusotInfos().then(() => {
  console.log("✅ Processus terminé.");
});
