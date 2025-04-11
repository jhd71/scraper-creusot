const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeCreusotInfos() {
  const browser = await puppeteer.launch({
    headless: true,
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

  // Pour déboguer, vous pouvez sauvegarder le HTML du listing
  // const debugContent = await page.content();
  // await fs.promises.writeFile('debug_listing.html', debugContent);

  // Extraction des articles par index, en supposant que les arrays
  // de titres, dates et résumés sont alignés
  const articles = await page.evaluate(() => {
    // Récupérer tous les éléments correspondants aux titres, dates et résumés
    const titleNodes = Array.from(document.querySelectorAll('.newsListTitle'));
    const dateNodes = Array.from(document.querySelectorAll('.newsListPubli'));
    const resumeNodes = Array.from(document.querySelectorAll('.newsListResume'));

    // (Optionnel) Récupérer une image à partir des titres (s'il y en a)
    const imageNodes = titleNodes.map(el => {
      const img = el.querySelector('img');
      return img ? img.src : '';
    });

    const results = [];
    // On prend le minimum des nombres récupérés pour éviter les erreurs d'index
    const count = Math.min(titleNodes.length, dateNodes.length, resumeNodes.length);
    for (let i = 0; i < count; i++) {
      // Récupérer le titre et le lien
      const titleEl = titleNodes[i];
      const aEl = titleEl.querySelector('a');
      const title = titleEl.textContent.trim();
      const link = aEl ? aEl.href : '';

      // Récupérer la date et le convertir
      const dateText = dateNodes[i] ? dateNodes[i].textContent.trim() : '';
      let isoDate = '';
      if (dateText) {
        // Le format est supposé "DD/MM/YYYY HH:mm", par exemple "10/04/2025 16:26"
        const parts = dateText.split(' ');
        if (parts.length === 2) {
          const dateParts = parts[0].split('/');
          if (dateParts.length === 3) {
            isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T${parts[1]}:00`;
          }
        }
      }
      
      // Récupérer le résumé
      const summary = resumeNodes[i] ? resumeNodes[i].textContent.trim() : '';

      // On ajoute l'article s'il contient toutes les informations essentielles
      if (title && link && isoDate && title.length > 5) {
        results.push({
          title,
          link,
          image: imageNodes[i],
          date: isoDate,
          summary,
          source: 'Creusot Infos'
        });
      }
    }
    
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
