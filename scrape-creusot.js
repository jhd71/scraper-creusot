const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeCreusotInfos() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  // Attendre que la page soit complètement chargée
await page.goto('https://www.creusot-infos.com/news/faits-divers/', {
  waitUntil: 'networkidle2',
  timeout: 30000
});

// Remplacer await page.waitForTimeout(5000);
await new Promise(resolve => setTimeout(resolve, 5000));

await page.waitForSelector('div.newsFullPubli', { timeout: 20000 });

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

  // Étape 1 : Récupérer les URLs des articles depuis la page de listing
const articleLinks = await page.evaluate(() => {
  const links = [];
  // Adaptez ce sélecteur au listing ; par exemple, s'il existe un conteneur pour chaque article
  const items = document.querySelectorAll('.news-item'); // ou un sélecteur qui correspond
  items.forEach(item => {
    const linkEl = item.querySelector('a');
    if (linkEl) links.push(linkEl.href);
  });
  return links.slice(0, 5); // Limiter à 5 articles
});

// Étape 2 : Pour chaque URL, ouvrir la page et extraire la date réelle
const results = [];
for (const url of articleLinks) {
  const articlePage = await browser.newPage();
  await articlePage.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  // Vérifie que l'élément contenant la date est présent
  await articlePage.waitForSelector('div.newsFullPubli', { timeout: 20000 });
  
  const articleData = await articlePage.evaluate(() => {
    const dateEl = document.querySelector('div.newsFullPubli');
    const titleEl = document.querySelector('.newsFullTitle');
    const imageEl = document.querySelector('.newsFullImg');
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
      title: titleEl ? titleEl.textContent.trim() : '',
      link: document.location.href,
      image: imageEl ? imageEl.src : '',
      date: isoDate,
      source: 'Creusot Infos'
    };
  });
  
  results.push(articleData);
  await articlePage.close();
}

await fs.promises.writeFile('data/articles.json', JSON.stringify(results, null, 2));
await browser.close();

  console.log("✅ Scraping terminé.");
}

scrapeCreusotInfos().then(() => {
  console.log("✅ Processus terminé.");
});
