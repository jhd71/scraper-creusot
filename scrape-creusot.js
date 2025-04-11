const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeCreusotInfos() {
  const browser = await puppeteer.launch({
    headless: true,  // Mode headless pour GitHub Actions
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const listingUrl = 'https://www.creusot-infos.com/news/faits-divers/';
  
  await page.goto(listingUrl, {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  // Attendre quelques secondes supplémentaires pour que le contenu soit chargé
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // DEBUG (optionnel) : Sauvegarder le contenu de la page dans un fichier pour vérification
  // const content = await page.content();
  // await fs.promises.writeFile('debug_listing.html', content);
  
  const articles = await page.evaluate(() => {
    const results = [];
    
    // Tente d'utiliser un conteneur commun pour chaque article (par exemple, ".newsListItem")
    let items = document.querySelectorAll('.newsListItem');
    
    // Si aucun conteneur n'est trouvé, alors on récupère les éléments à partir du titre
    if (items.length === 0) {
      const titleEls = document.querySelectorAll('.newsListTitle');
      items = [];
      titleEls.forEach(el => {
        // Utilisation du parent direct comme conteneur (ou modifiez avec .closest('div') si nécessaire)
        if (el.parentElement) items.push(el.parentElement);
      });
    }
    
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

      let isoDate = '';
      if (dateText) {
        // Supposé format "DD/MM/YYYY HH:mm"
        const parts = dateText.split(' ');
        if (parts.length === 2) {
          const dateParts = parts[0].split('/');
          if (dateParts.length === 3) {
            isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T${parts[1]}:00`;
          }
        }
      }
      
      // On ajoute l'article uniquement si toutes les infos essentielles sont présentes
      if (title && link && image && isoDate && resume && title.length > 10) {
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

  // Limiter par exemple aux 5 premiers articles (vous pouvez supprimer cette limitation si nécessaire)
  const limitedArticles = articles.slice(0, 5);
  
  await fs.promises.writeFile('data/articles.json', JSON.stringify(limitedArticles, null, 2));
  await browser.close();
  console.log("✅ Scraping terminé.");
}

scrapeCreusotInfos().then(() => {
  console.log("✅ Processus terminé.");
});
