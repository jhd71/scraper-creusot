const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeCreusotInfos() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Configuration pour simuler un utilisateur réel
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    console.log("Accès à la page des faits divers...");
    await page.goto('https://www.creusot-infos.com/news/faits-divers/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Attendre que la page soit chargée
    await page.waitForSelector('body', { timeout: 15000 });
    console.log("Page chargée, recherche des articles...");

    // Capture d'écran pour le débogage (optionnel - utile pour voir ce que Puppeteer voit)
    await page.screenshot({ path: 'debug-screenshot.png' });

    const articles = await page.evaluate(() => {
      // Essayons plusieurs sélecteurs pour trouver les articles
      const selectors = [
        '.listingArticle', 
        '.article-item',
        '.news-item',
        '.article',
        'article'
      ];
      
      let articleElements = [];
      
      // Essayer chaque sélecteur jusqu'à en trouver un qui fonctionne
      for (const selector of selectors) {
        const elements = Array.from(document.querySelectorAll(selector));
        if (elements.length > 0) {
          articleElements = elements;
          console.log(`Trouvé ${elements.length} articles avec le sélecteur ${selector}`);
          break;
        }
      }
      
      // Si aucun sélecteur ne fonctionne, essayons une approche plus générique
      if (articleElements.length === 0) {
        // Recherche d'éléments contenant des liens et du texte pouvant être des articles
        const allLinks = Array.from(document.querySelectorAll('a[href*="/news/"]'));
        const potentialArticles = new Set();
        
        for (const link of allLinks) {
          // Remonter pour trouver un conteneur potentiel d'article
          let parent = link.parentElement;
          for (let i = 0; i < 5 && parent; i++) {
            if (parent.querySelectorAll('a[href*="/news/"]').length === 1) {
              potentialArticles.add(parent);
              break;
            }
            parent = parent.parentElement;
          }
        }
        
        articleElements = Array.from(potentialArticles);
        console.log(`Approche alternative: trouvé ${articleElements.length} articles potentiels`);
      }
      
      // Extraction des informations pour chaque article trouvé
      const results = [];
      
      for (const article of articleElements) {
        // Recherche du titre et du lien (on essaie plusieurs approches)
        let title = null;
        let href = null;
        let titleElement = article.querySelector('h2') || article.querySelector('h3') || article.querySelector('.title');
        
        if (titleElement) {
          title = titleElement.textContent.trim();
          const linkInTitle = titleElement.querySelector('a');
          if (linkInTitle) {
            href = linkInTitle.href;
          }
        }
        
        // Si on n'a pas trouvé de lien dans le titre, cherchons ailleurs
        if (!href) {
          const mainLink = article.querySelector('a[href*="/news/"]');
          if (mainLink) {
            href = mainLink.href;
            if (!title) title = mainLink.textContent.trim();
          }
        }
        
        // Recherche d'image
        let image = null;
        const imgElement = article.querySelector('img');
        if (imgElement && imgElement.src) {
          image = imgElement.src;
        }
        
        // Si pas d'image trouvée, cherchons un div avec background-image
        if (!image) {
          const divs = article.querySelectorAll('div');
          for (const div of divs) {
            const style = window.getComputedStyle(div);
            if (style.backgroundImage && style.backgroundImage !== 'none') {
              image = style.backgroundImage.replace(/url\(['"]?(.*?)['"]?\)/i, '$1');
              break;
            }
          }
        }
        
        // Recherche de la date dans l'article
        let dateText = null;
        const dateSelectors = ['.date', '.time', '.published', 'time', '.article-date'];
        
        for (const selector of dateSelectors) {
          const dateElement = article.querySelector(selector);
          if (dateElement) {
            dateText = dateElement.textContent.trim();
            break;
          }
        }
        
        // Filtrage des résultats
        if (title && href && title.length > 10) {
          results.push({
            title,
            link: href,
            image: image || '',
            rawDate: dateText,
            source: 'Creusot Infos'
          });
        }
      }
      
      // Limiter à 5 résultats maximum
      return results.slice(0, 5);
    });
    
    console.log(`Trouvé ${articles.length} articles, récupération des dates précises...`);
    
    // Pour chaque article, on visite sa page pour récupérer la date exacte
    for (let i = 0; i < articles.length; i++) {
      try {
        console.log(`Visite de l'article: ${articles[i].link}`);
        await page.goto(articles[i].link, { 
          waitUntil: 'networkidle2', 
          timeout: 20000 
        });
        
        const articleData = await page.evaluate(() => {
          // Chercher la date dans la page de l'article avec plusieurs sélecteurs possibles
          const dateSelectors = [
            '.article_infos .date', 
            '.date', 
            '.article-date',
            'time',
            '.published',
            'meta[property="article:published_time"]',
            'meta[itemprop="datePublished"]'
          ];
          
          let exactDate = null;
          
          for (const selector of dateSelectors) {
            const el = document.querySelector(selector);
            if (el) {
              if (el.tagName === 'META') {
                exactDate = el.getAttribute('content');
              } else {
                exactDate = el.textContent.trim();
              }
              if (exactDate) break;
            }
          }
          
          // Chercher une meilleure image si possible
          const imgSelectors = [
            '.article_image img',
            '.featured-image img',
            '.article-image img',
            'article img',
            '.content img'
          ];
          
          let bestImage = null;
          
          for (const selector of imgSelectors) {
            const img = document.querySelector(selector);
            if (img && img.src) {
              bestImage = img.src;
              break;
            }
          }
          
          // Si toujours pas d'image, chercher un div avec background-image
          if (!bestImage) {
            const bgSelectors = ['.article_image', '.featured-image', '.article-image'];
            for (const selector of bgSelectors) {
              const div = document.querySelector(selector);
              if (div) {
                const style = window.getComputedStyle(div);
                if (style.backgroundImage && style.backgroundImage !== 'none') {
                  bestImage = style.backgroundImage.replace(/url\(['"]?(.*?)['"]?\)/i, '$1');
                  break;
                }
              }
            }
          }
          
          return { 
            exactDate,
            bestImage
          };
        });
        
        if (articleData.exactDate) {
          articles[i].rawDate = articleData.exactDate;
          
          // Tentative de détection du format et conversion en ISO
          if (articleData.exactDate.includes('T') && /\d{4}-\d{2}-\d{2}T/.test(articleData.exactDate)) {
            // C'est déjà au format ISO
            articles[i].date = articleData.exactDate;
          } else {
            // C'est probablement un format français
            articles[i].date = parseFrenchDate(articleData.exactDate);
          }
        } else if (articles[i].rawDate) {
          articles[i].date = parseFrenchDate(articles[i].rawDate);
        } else {
          articles[i].date = new Date().toISOString();
        }
        
        // Mise à jour de l'image si on en a trouvé une meilleure
        if (articleData.bestImage && (!articles[i].image || articles[i].image === '')) {
          articles[i].image = articleData.bestImage;
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

    // Nettoyage final et formatage pour le fichier JSON
    articles.forEach(article => {
      delete article.rawDate; // On supprime la date brute qui ne nous est plus utile
    });

    console.log("Écriture des résultats dans le fichier JSON...");
    
    // S'assurer que le dossier data existe
    if (!fs.existsSync('data')) {
      fs.mkdirSync('data', { recursive: true });
    }
    
    await fs.promises.writeFile('data/articles.json', JSON.stringify(articles, null, 2));
    console.log("✅ Fichier articles.json créé avec succès");
    
  } catch (error) {
    console.error("Erreur lors du scraping:", error);
  } finally {
    await browser.close();
    console.log("✅ Navigateur fermé, scraping terminé");
  }
}

// Fonction pour convertir une date française en format ISO
function parseFrenchDate(dateStr) {
  if (!dateStr) return new Date().toISOString();
  
  const monthsMap = {
    'janvier': 0, 'février': 1, 'mars': 2, 'avril': 3,
    'mai': 4, 'juin': 5, 'juillet': 6, 'août': 7,
    'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11,
    'jan': 0, 'fév': 1, 'mar': 2, 'avr': 3,
    'mai': 4, 'juin': 5, 'juil': 6, 'août': 7,
    'sep': 8, 'oct': 9, 'nov': 10, 'déc': 11
  };
  
  try {
    // Essayer d'abord de parser un ISO date
    if (/\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      return new Date(dateStr).toISOString();
    }
    
    // Normalisation de la chaîne: suppression du jour de la semaine
    const normalizedStr = dateStr
      .replace(/^(Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche)\s+/i, '')
      .replace(/\s*-\s*/g, ' ');
    
    // Extraction de la date
    const dateMatch = normalizedStr.match(/(\d{1,2})\s+([^\s\d]+)\s+(\d{4})/i);
    
    if (!dateMatch) {
      console.warn(`Format de date non reconnu: ${dateStr}`);
      return new Date().toISOString();
    }
    
    const day = parseInt(dateMatch[1], 10);
    const monthLower = dateMatch[2].toLowerCase();
    const month = monthsMap[monthLower];
    const year = parseInt(dateMatch[3], 10);
    
    // Extraction de l'heure
    const timeMatch = normalizedStr.match(/(\d{1,2})[h:](\d{2})/i);
    const hour = timeMatch ? parseInt(timeMatch[1], 10) : 0;
    const minute = timeMatch ? parseInt(timeMatch[2], 10) : 0;
    
    if (month === undefined) {
      console.warn(`Mois non reconnu: ${monthLower} dans "${dateStr}"`);
      return new Date().toISOString();
    }
    
    const date = new Date(Date.UTC(year, month, day, hour, minute));
    return date.toISOString();
  } catch (e) {
    console.error("Erreur lors du parsing de la date:", dateStr, e);
    return new Date().toISOString();
  }
}

// Lancement du scraping
console.log("Démarrage du scraping...");
scrapeCreusotInfos().then(() => {
  console.log("✅ Scraping terminé avec succès.");
}).catch(error => {
  console.error("❌ Erreur globale:", error);
  process.exit(1);
});
