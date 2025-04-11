const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeCreusotInfos() {
  // Lance Puppeteer en mode headless (pour GitHub Actions, par exemple)
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  // Charger la page de listing des articles
  const listingUrl = 'https://www.creusot-infos.com/news/faits-divers/';
  await page.goto(listingUrl, {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  // Optionnel : Attendre quelques secondes si le contenu est chargé dynamiquement
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Vérifier si le contenu du listing est bien chargé (débug possible)
  // const content = await page.content();
  // await fs.promises.writeFile('debug_listing.html', content);

  // Extraction des articles depuis la page de listing
  const articles = await page.evaluate(() => {
    const results = [];
    // On part du principe que chaque article possède un titre avec la classe "newsListTitle".
    // Nous utilisons ce sélecteur pour récupérer tous les titres et ensuite leurs conteneurs.
    const titleElements = Array.from(document.querySelectorAll('.newsListItem .newsListTitle'));
    
    titleElements.forEach(titleEl => {
      // On prend le conteneur parent (à adapter si nécessaire, par ex. avec .closest('.newsListItem'))
      const container = titleEl.parentElement;
      const title = titleEl.textContent.trim();

      // Récupérer le lien depuis une balise <a> contenue dans le container
      const linkEl = container.querySelector('a');
      const link = linkEl ? linkEl.href : document.location.href;
      
      // Récupérer l'image depuis la balise <img> (si présente)
      const imageEl = container.querySelector('img');
      const image = imageEl ? imageEl.src : '';

      // Récupérer la date de publication depuis l'élément ayant la classe "newsListPubli"
      const dateEl = container.querySelector('.newsListPubli');
      const dateText = dateEl ? dateEl.textContent.trim() : '';
      let isoDate = '';
      if (dateText) {
        // Le format attendu est "DD/MM/YYYY HH:mm", par exemple "10/04/2025 16:26"
        const parts = dateText.split(' ');
        if (parts.length === 2) {
          const dateParts = parts[0].split('/');
          if (dateParts.length === 3) {
            isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T${parts[1]}:00`;
          }
        }
      }

      // Récupérer le résumé depuis l'élément avec la classe "newsListResume"
      const resumeEl = container.querySelector('.newsListResume');
      const resume = resumeEl ? resumeEl.textContent.trim() : '';

      // On ajoute l'article uniquement si toutes les informations essentielles sont présentes
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

  // Optionnel : Log du nombre d'articles trouvés pour debug
  console.log(`Nombre d'articles récupérés: ${articles.length}`);

  // Sauvegarder le résultat dans le fichier JSON
  await fs.promises.writeFile('data/articles.json', JSON.stringify(articles, null, 2));
  await browser.close();
  console.log("✅ Scraping terminé.");
}

scrapeCreusotInfos().then(() => {
  console.log("✅ Processus terminé.");
});
