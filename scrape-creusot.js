const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeCreusotInfos() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('https://www.creusot-infos.com/news/faits-divers/', {
    waitUntil: 'domcontentloaded',
    timeout: 20000
  });

  await page.waitForSelector('.columns_content', { timeout: 10000 });

  const articles = await page.evaluate(() => {
    // Sélecteur plus précis pour les articles sur la page Faits-divers
    const articleElements = Array.from(document.querySelectorAll('.columns_content .listingArticle'));
    const results = [];

    for (const article of articleElements) {
      const link = article.querySelector('.title a');
      const title = link?.textContent?.trim();
      const href = link?.href;
      
      // Obtention de l'URL de l'image - soit depuis l'élément img, soit depuis le style background-image
      let image = article.querySelector('.image img')?.src;
      if (!image) {
        const imageDiv = article.querySelector('.image');
        if (imageDiv) {
          const bgStyle = window.getComputedStyle(imageDiv).backgroundImage;
          if (bgStyle && bgStyle !== 'none') {
            image = bgStyle.replace(/url\(['"]?(.*?)['"]?\)/i, '$1');
          }
        }
      }
      
      // Extraction de la date de publication
      const dateElement = article.querySelector('.date');
      let publishDate = null;
      
      if (dateElement) {
        publishDate = dateElement.textContent.trim();
      } else {
        // Si pas de date trouvée, on utilisera la date après visite de la page de l'article
        publishDate = null;
      }

      if (title && href && title.length > 10) {
        results.push({
          title,
          link: href,
          image: image || '',
          rawDate: publishDate,
          date: null, // Sera complété plus tard
          source: 'Creusot Infos'
        });
      }

      if (results.length >= 5) break;
    }

    return results;
  });

  // Pour chaque article, on visite sa page pour récupérer la date exacte
  for (let i = 0; i < articles.length; i++) {
    try {
      console.log(`Visite de l'article: ${articles[i].link}`);
      await page.goto(articles[i].link, { waitUntil: 'domcontentloaded', timeout: 15000 });
      
      const articleData = await page.evaluate(() => {
        // Chercher la date dans la page de l'article
        const dateEl = document.querySelector('.article_infos .date');
        const imageEl = document.querySelector('.article_image img') || document.querySelector('.article_image');
        
        let imageUrl = '';
        if (imageEl) {
          if (imageEl.tagName === 'IMG') {
            imageUrl = imageEl.src;
          } else {
            const bgStyle = window.getComputedStyle(imageEl).backgroundImage;
            if (bgStyle && bgStyle !== 'none') {
              imageUrl = bgStyle.replace(/url\(['"]?(.*?)['"]?\)/i, '$1');
            }
          }
        }
        
        return { 
          exactDate: dateEl ? dateEl.textContent.trim() : null,
          image: imageUrl || null
        };
      });
      
      if (articleData.exactDate) {
        articles[i].rawDate = articleData.exactDate;
        articles[i].date = parseFrenchDate(articleData.exactDate);
      } else if (articles[i].rawDate) {
        articles[i].date = parseFrenchDate(articles[i].rawDate);
      } else {
        articles[i].date = new Date().toISOString();
      }
      
      // Si on n'a pas d'image depuis la liste, on utilise celle de la page détaillée
      if (!articles[i].image && articleData.image) {
        articles[i].image = articleData.image;
      }
      
    } catch (error) {
      console.error(`Erreur lors de la récupération des données pour ${articles[i].link}:`, error);
      // En cas d'erreur, on utilise la date brute si disponible, sinon la date actuelle
      if (articles[i].rawDate) {
        articles[i].date = parseFrenchDate(articles[i].rawDate);
      } else {
        articles[i].date = new Date().toISOString();
      }
    }
  }

  // Nettoyage final avant d'écrire le fichier
  articles.forEach(article => {
    delete article.rawDate; // On supprime la date brute qui ne nous est plus utile
  });

  await fs.promises.writeFile('data/articles.json', JSON.stringify(articles, null, 2));
  await browser.close();
}

// Fonction pour convertir une date française en format ISO
function parseFrenchDate(dateStr) {
  // Format typique sur Creusot Infos: "Mercredi 9 Avril 2025 - 18:00"
  const monthsMap = {
    'janvier': 0, 'février': 1, 'mars': 2, 'avril': 3,
    'mai': 4, 'juin': 5, 'juillet': 6, 'août': 7,
    'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11
  };
  
  try {
    // Normalisation de la chaîne: suppression du jour de la semaine et des tirets
    const normalizedStr = dateStr
      .replace(/^(Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche)\s+/i, '')
      .replace(/\s*-\s*/g, ' ');
    
    const parts = normalizedStr.split(' ');
    
    // Format attendu après normalisation: "9 Avril 2025 18:00"
    const day = parseInt(parts[0], 10);
    const monthLower = parts[1].toLowerCase();
    const month = monthsMap[monthLower];
    const year = parseInt(parts[2], 10);
    
    const timeParts = parts[3] ? parts[3].split(':') : ['00', '00'];
    const hour = parseInt(timeParts[0], 10);
    const minute = parseInt(timeParts[1], 10);
    
    const date = new Date(Date.UTC(year, month, day, hour, minute));
    return date.toISOString();
  } catch (e) {
    console.error("Erreur lors du parsing de la date:", dateStr, e);
    return new Date().toISOString();
  }
}

scrapeCreusotInfos().then(() => {
  console.log("✅ Scraping terminé.");
});
