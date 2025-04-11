const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeCreusotInfos() {
  const browser = await puppeteer.launch({
    headless: true, // Mode headless pour GitHub Actions
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  const listingUrl = 'https://www.creusot-infos.com/news/faits-divers/';
  await page.goto(listingUrl, { 
    waitUntil: 'networkidle2', 
    timeout: 30000 
  });
  
  // Attendre quelques secondes pour que le contenu dynamique se charge
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Optionnel : Pour déboguer, sauvegardez le HTML obtenu :
  // const content = await page.content();
  // await fs.promises.writeFile('debug_listing.html', content);

  // Extraction des articles en se basant sur la structure séquentielle
  const articles = await page.evaluate(() => {
    const results = [];
    // On récupère tous les éléments ayant la classe "newsListTitle"
    const titleEls = Array.from(document.querySelectorAll('.newsListTitle'));

    titleEls.forEach(titleEl => {
      // Récupération du titre et du lien
      const linkEl = titleEl.querySelector('a');
      const title = titleEl.textContent.trim();
      const link = linkEl ? linkEl.href : '';

      // Supposons que le prochain élément frère est celui de la date
      let dateText = '';
      let resume = '';
      const dateEl = titleEl.nextElementSibling;
      if (dateEl && dateEl.classList.contains('newsListPubli')) {
        dateText = dateEl.textContent.trim();
      }
      // Et celui qui suit immédiatement la date est le résumé
      const resumeEl = dateEl ? dateEl.nextElementSibling : null;
      if (resumeEl && resumeEl.classList.contains('newsListResume')) {
        resume = resumeEl.textContent.trim();
      }
      
      // Récupérer l'image (si présente) dans le même conteneur
      const imageEl = titleEl.parentElement.querySelector('img');
      const image = imageEl ? imageEl.src : '';

      // Conversion de la date du format "DD/MM/YYYY HH:mm" en ISO
      let isoDate = '';
      if (dateText) {
        // Exemple : "10/04/2025 16:26" devient "2025-04-10T16:26:00"
        const parts = dateText.split(' ');
        if (parts.length === 2) {
          const dateParts = parts[0].split('/');
          if (dateParts.length === 3) {
            isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T${parts[1]}:00`;
          }
        }
      }

      // On ajoute l'article s'il a un titre, un lien et une date valide
      if (title && link && isoDate && title.length > 5) {
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
  await fs.promises.writeFile('data/articles.json', JSON.stringify(articles, null, 2));
  await browser.close();
  console.log("✅ Scraping terminé.");
}

scrapeCreusotInfos().then(() => {
  console.log("✅ Processus terminé.");
});
