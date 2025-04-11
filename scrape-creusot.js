const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeCreusotInfos() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('https://www.creusot-infos.com/news/faits-divers/', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });
  
  // Extraire les liens des articles depuis la page de listing
  const articleLinks = await page.evaluate(() => {
    const links = [];
    // Adaptez ce sélecteur selon la structure du listing – par exemple, si chaque article a la classe "news-item"
    document.querySelectorAll('.news-item a').forEach(link => {
      if (link.href) {
        links.push(link.href);
      }
    });
    return links.slice(0, 5); // Limiter, par exemple, à 5 articles
  });

  console.log('Articles à scrapper :', articleLinks);

  // Initialiser un tableau pour stocker les données
  const results = [];
  // Itérer sur les liens pour scrapper chaque page d'article
  for (const url of articleLinks) {
    const articlePage = await browser.newPage();
    try {
      await articlePage.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      // On peut insérer un délai manuel pour s'assurer que le contenu se charge
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      await articlePage.waitForSelector('div.newsFullPubli', { timeout: 30000 });
      
      const articleData = await articlePage.evaluate(() => {
        const titleEl = document.querySelector('.newsFullTitle');
        const imageEl = document.querySelector('.newsFullImg');
        const dateEl = document.querySelector('div.newsFullPubli');
        const dateText = dateEl ? dateEl.textContent.trim() : '';
        let isoDate = '';
        if (dateText) {
          const parts = dateText.split(' '); // ex: ["10/04/2025", "16:26"]
          if (parts.length === 2) {
            const dateParts = parts[0].split('/');
            if (dateParts.length === 3) {
              isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T${parts[1]}:00`;
            }
          }
        }
        return {
          title: titleEl ? titleEl.textContent.trim() : '',
          link: document.location.href,
          image: imageEl ? imageEl.src : '',
          date: isoDate,
          source: 'Creusot Infos'
        };
      });
      
      results.push(articleData);
      await articlePage.close();
    } catch (err) {
      console.error('Erreur sur la page', url, err);
      await articlePage.close();
    }
  }
  
  await fs.promises.writeFile('data/articles.json', JSON.stringify(results, null, 2));
  await browser.close();
  console.log("✅ Scraping terminé.");
}

scrapeCreusotInfos().then(() => {
  console.log("✅ Processus terminé.");
});
