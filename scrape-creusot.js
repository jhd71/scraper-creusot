const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeCreusotInfos() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-notifications', // Désactiver les notifications
      '--window-size=1920,1080' // Fenêtre plus grande pour voir tout le contenu
    ]
  });

  try {
    const page = await browser.newPage();
    
    // Configuration pour simuler un utilisateur réel
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Bloquer les popups et bannières potentielles
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (['image', 'stylesheet', 'font'].includes(request.resourceType())) {
        request.continue();
      } else {
        // Bloquer les scripts de popup et d'annonces potentiels
        const url = request.url().toLowerCase();
        if (url.includes('popup') || url.includes('banner') || url.includes('ad.js')) {
          request.abort();
        } else {
          request.continue();
        }
      }
    });

    console.log("Accès à la page des faits divers...");
    await page.goto('https://www.creusot-infos.com/news/faits-divers/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Attendre que la page soit chargée
    await page.waitForSelector('body', { timeout: 15000 });
    console.log("Page chargée");
    
    // Prendre une capture d'écran pour débogage
    await page.screenshot({ path: 'debug-page.png', fullPage: true });
    
    // Fermer toute bannière ou popup qui pourrait obscurcir le contenu
    await page.evaluate(() => {
      // Chercher des boutons de fermeture typiques
      const closeButtons = Array.from(document.querySelectorAll('button, a, div')).filter(el => {
        const text = el.textContent.toLowerCase();
        const classes = el.className.toLowerCase();
        return text.includes('fermer') || 
               text.includes('close') || 
               text.includes('×') ||
               classes.includes('close') || 
               classes.includes('dismiss');
      });
      
      // Cliquer sur tous les boutons de fermeture trouvés
      closeButtons.forEach(button => button.click());
      
      // Aussi, masquer les éléments qui pourraient être des popups/bannières
      const possiblePopups = document.querySelectorAll('.popup, .banner, .modal, .notification');
      possiblePopups.forEach(popup => {
        if (popup) popup.style.display = 'none';
      });
    });
    
    // Attendre un peu que les popups disparaissent
    await page.waitForTimeout(1000);
    
    console.log("Recherche des articles de faits divers...");
    
    // Extraction des articles spécifiquement dans la section des faits divers
    const articles = await page.evaluate(() => {
      // Ignorer le widget d'actualités en direct
      const ignoreSelectors = [
        '.actualites-direct',
        '.widget-actualites',
        '.breaking-news',
        '.live-news'
      ];
      
      // Cacher les éléments à ignorer
      ignoreSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (el) el.style.display = 'none';
        });
      });
      
      // Recherche des articles de faits divers dans le contenu principal
      const mainContent = document.querySelector('#main-content') || 
                          document.querySelector('.main-content') || 
                          document.querySelector('main') ||
                          document.querySelector('.content') || 
                          document.body;
      
      // Recherche des articles dans le contenu principal
      const articlesSelectors = [
        '.article', 
        '.news-item', 
        'article',
        '.post',
        '.list-article'
      ];
      
      let articleElements = [];
      
      // Essayer de trouver des articles avec les sélecteurs courants
      for (const selector of articlesSelectors) {
        const elements = Array.from(mainContent.querySelectorAll(selector));
        if (elements.length > 0) {
          articleElements = elements;
          console.log(`Trouvé ${elements.length} articles avec le sélecteur ${selector}`);
          break;
        }
      }
      
      // Si rien n'est trouvé, chercher des liens qui pourraient être des articles
      if (articleElements.length === 0) {
        const allLinks = Array.from(mainContent.querySelectorAll('a[href*="/faits-divers/"]'));
        
        // Remonter à un élément parent qui pourrait être l'article complet
        const potentialArticles = new Set();
        for (const link of allLinks) {
          let current = link;
          for (let i = 0; i < 5 && current; i++) {
            if (current.tagName === 'ARTICLE' || 
                current.classList.contains('article') || 
                current.classList.contains('news-item')) {
              potentialArticles.add(current);
              break;
            }
            current = current.parentElement;
          }
          
          // Si aucun parent article n'est trouvé, utiliser le parent direct
          if (!potentialArticles.has(link) && link.parentElement) {
            potentialArticles.add(link.closest('div') || link.parentElement);
          }
        }
        
        articleElements = Array.from(potentialArticles);
      }
      
      // Si toujours rien, chercher des éléments avec image et texte
      if (articleElements.length === 0) {
        const divs = Array.from(mainContent.querySelectorAll('div'));
        const potentialArticles = divs.filter(div => {
          // Un div qui contient une image et du texte est probablement un article
          const hasImage = div.querySelector('img') !== null;
          const hasText = div.textContent.trim().length > 50;
          const hasLink = div.querySelector('a') !== null;
          return hasImage && hasText && hasLink;
        });
        
        articleElements = potentialArticles;
      }
      
      console.log(`Total de ${articleElements.length} éléments d'articles trouvés`);
      
      // Extraction des données des articles
      const results = [];
      
      for (const articleEl of articleElements) {
        // Recherche du titre
        let title = null;
        let titleElement = articleEl.querySelector('h1, h2, h3, h4, .title, .headline');
        
        if (titleElement) {
          title = titleElement.textContent.trim();
        }
        
        // Recherche du lien
        let link = null;
        let linkElement = titleElement?.querySelector('a') || articleEl.querySelector('a');
        
        if (linkElement) {
          link = linkElement.href;
          // Si pas de titre trouvé, utiliser le texte du lien
          if (!title) {
            title = linkElement.textContent.trim();
          }
        }
        
        // Filtrer pour s'assurer que c'est bien un article de faits divers
        if (link && !link.includes('/faits-divers/')) {
          continue;
        }
        
        // Recherche de l'image
        let image = null;
        const imgElement = articleEl.querySelector('img');
        
        if (imgElement && imgElement.src) {
          image = imgElement.src;
        } else {
          // Recherche d'une image en background
          const elementsWithBg = Array.from(articleEl.querySelectorAll('*'));
          for (const el of elementsWithBg) {
            const style = window.getComputedStyle(el);
            if (style.backgroundImage && style.backgroundImage !== 'none') {
              image = style.backgroundImage.replace(/url\(['"]?(.*?)['"]?\)/i, '$1');
              break;
            }
          }
        }
        
        // Recherche de la date
        let dateText = null;
        const dateElement = articleEl.querySelector('.date, time, .published, [datetime]');
        
        if (dateElement) {
          if (dateElement.hasAttribute('datetime')) {
            dateText = dateElement.getAttribute('datetime');
          } else {
            dateText = dateElement.textContent.trim();
          }
        }
        
        // Vérification finale et ajout au résultat
        if (title && link && title.length > 10) {
          results.push({
            title,
            link,
            image: image || '',
            rawDate: dateText,
            source: 'Creusot Infos'
          });
        }
      }
      
      console.log(`${results.length} articles valides trouvés`);
      return results.slice(0, 5); // Limiter à 5 résultats
    });
    
    console.log(`Trouvé ${articles.length} articles de faits divers, visite des pages individuelles...`);
    
    // Visiter chaque page d'article pour obtenir la date exacte
    for (let i = 0; i < articles.length; i++) {
      try {
        console.log(`Visite de l'article ${i+1}: ${articles[i].link}`);
        await page.goto(articles[i].link, { 
          waitUntil: 'networkidle2', 
          timeout: 20000 
        });
        
        // Capture d'écran de l'article pour débogage
        if (i === 0) {
          await page.screenshot({ path: `debug-article.png`, fullPage: true });
        }
        
        const articleData = await page.evaluate(() => {
          // Chercher la date avec plusieurs approches
          let exactDate = null;
          
          // 1. Méta tags (les plus fiables)
          const metaTags = [
            'meta[property="article:published_time"]',
            'meta[itemprop="datePublished"]',
            'meta[name="date"]',
            'meta[name="publication-date"]'
          ];
          
          for (const selector of metaTags) {
            const meta = document.querySelector(selector);
            if (meta) {
              exactDate = meta.getAttribute('content');
              if (exactDate) break;
            }
          }
          
          // 2. Éléments HTML avec date
          if (!exactDate) {
            const dateSelectors = [
              '.article-info .date',
              '.article_info .date',
              '.meta .date',
              '.post-meta time',
              '.post-date',
              '.date',
              'time'
            ];
            
            for (const selector of dateSelectors) {
              const el = document.querySelector(selector);
              if (el) {
                if (el.hasAttribute('datetime')) {
                  exactDate = el.getAttribute('datetime');
                } else {
                  exactDate = el.textContent.trim();
                }
                if (exactDate) break;
              }
            }
          }
          
          // 3. Recherche de motifs de date dans le texte
          if (!exactDate) {
            const bodyText = document.body.textContent;
            const dateRegex = /(\d{1,2})[/-\s](\w+)[/-\s](\d{4})/;
            const match = bodyText.match(dateRegex);
            if (match) {
              exactDate = match[0];
            }
          }
          
          // Recherche d'une meilleure image
          let bestImage = null;
          
          const mainImage = document.querySelector('.article-image img') || 
                           document.querySelector('.featured-image img') ||
                           document.querySelector('.post-thumbnail img') ||
                           document.querySelector('article img');
          
          if (mainImage && mainImage.src) {
            bestImage = mainImage.src;
          }
          
          return { exactDate, bestImage };
        });
        
        // Traitement de la date
        if (articleData.exactDate) {
          articles[i].rawDate = articleData.exactDate;
          
          // Tentative de détection du format
          if (articleData.exactDate.includes('T') && /\d{4}-\d{2}-\d{2}T/.test(articleData.exactDate)) {
            // Format ISO
            articles[i].date = articleData.exactDate;
          } else {
            // Format français ou autre
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
        console.error(`Erreur lors de la visite de l'article ${i+1}:`, error);
        // Fallback si erreur
        if (articles[i].rawDate) {
          articles[i].date = parseFrenchDate(articles[i].rawDate);
        } else {
          articles[i].date = new Date().toISOString();
        }
      }
    }

    // Nettoyage et finalisation
    const finalArticles = articles.map(article => ({
      title: article.title,
      link: article.link,
      image: article.image,
      date: article.date,
      source: 'Creusot Infos'
    }));

    console.log("Écriture des résultats dans le fichier JSON...");
    
    // S'assurer que le dossier data existe
    if (!fs.existsSync('data')) {
      fs.mkdirSync('data', { recursive: true });
    }
    
    await fs.promises.writeFile('data/articles.json', JSON.stringify(finalArticles, null, 2));
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
    // 1. Tenter de parser un format ISO standard
    if (/\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const isoDate = new Date(dateStr);
      if (!isNaN(isoDate.getTime())) {
        return isoDate.toISOString();
      }
    }
    
    // 2. Normaliser le texte de date
    let normalizedStr = dateStr
      .replace(/^(Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche)\s+/i, '')
      .replace(/\s*-\s*/g, ' ')
      .trim();
      
    // 3. Formats français possibles
    
    // Format: "9 avril 2025 18:00"
    let match = normalizedStr.match(/(\d{1,2})\s+([^\s\d]+)\s+(\d{4})(?:\s+(\d{1,2})[h:](\d{2}))?/i);
    
    if (match) {
      const day = parseInt(match[1], 10);
      const monthStr = match[2].toLowerCase();
      const month = monthsMap[monthStr];
      const year = parseInt(match[3], 10);
      
      const hour = match[4] ? parseInt(match[4], 10) : 0;
      const minute = match[5] ? parseInt(match[5], 10) : 0;
      
      if (month !== undefined) {
        const date = new Date(Date.UTC(year, month, day, hour, minute));
        return date.toISOString();
      }
    }
    
    // Format: "09/04/2025 18:00"
    match = normalizedStr.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:\s+(\d{1,2})[h:](\d{2}))?/);
    
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // Les mois en JS sont 0-indexés
      const year = parseInt(match[3], 10);
      
      const hour = match[4] ? parseInt(match[4], 10) : 0;
      const minute = match[5] ? parseInt(match[5], 10) : 0;
      
      const date = new Date(Date.UTC(year, month, day, hour, minute));
      return date.toISOString();
    }
    
    // Format: "2025-04-09 18:00"
    match = normalizedStr.match(/(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})(?:\s+(\d{1,2})[h:](\d{2}))?/);
    
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      
      const hour = match[4] ? parseInt(match[4], 10) : 0;
      const minute = match[5] ? parseInt(match[5], 10) : 0;
      
      const date = new Date(Date.UTC(year, month, day, hour, minute));
      return date.toISOString();
    }
    
    // Si aucun format reconnu, utiliser la date actuelle
    console.warn(`Format de date non reconnu: "${dateStr}"`);
    return new Date().toISOString();
    
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
