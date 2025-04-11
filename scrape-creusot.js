const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeCreusotInfos() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-notifications',
      '--window-size=1920,1080'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // Configuration pour simuler un utilisateur réel
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    console.log("Accès à la page principale des faits divers...");
    await page.goto('https://www.creusot-infos.com/news/faits-divers/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Prendre une capture d'écran complète pour voir ce que voit le navigateur
    await page.screenshot({ path: 'debug-main-page.png', fullPage: true });
    
    // Extraction des articles directement depuis la page principale des faits divers
    const articles = await page.evaluate(() => {
      // Fonction pour extraire l'URL d'image d'un élément
      function extractImageUrl(element) {
        if (!element) return '';
        
        // D'abord chercher une image directe
        const img = element.querySelector('img');
        if (img && img.src) return img.src;
        
        // Ensuite chercher un background-image
        const style = window.getComputedStyle(element);
        if (style.backgroundImage && style.backgroundImage !== 'none') {
          return style.backgroundImage.replace(/url\(['"]?(.*?)['"]?\)/i, '$1');
        }
        
        return '';
      }
      
      // Rechercher tous les liens qui pourraient être des articles
      // Attention: on cible spécifiquement les articles (pas les sous-catégories)
      const allLinks = Array.from(document.querySelectorAll('a'));
      
      // Filtrer pour ne garder que les liens vers des articles de faits divers
      const articleLinks = allLinks.filter(link => {
        const href = link.href || '';
        // On veut des liens qui pointent vers des articles (.html) et pas vers des sous-catégories
        return href.includes('/news/faits-divers/') && 
               href.endsWith('.html') && 
               !href.includes('/vie-locale/') &&
               !href.includes('/opinion/') &&
               !href.includes('/sport/');
      });
      
      console.log(`Trouvé ${articleLinks.length} liens vers des articles`);
      
      // Extraction des infos pour chaque article
      const articles = [];
      
      for (const link of articleLinks) {
        // Ne pas inclure les liens comme "Lire la suite" ou similaires
        const text = link.textContent.trim();
        if (text.length < 10 || 
            ['lire la suite', 'read more', 'imprimer l\'article'].includes(text.toLowerCase())) {
          continue;
        }
        
        // Trouver le conteneur parent qui pourrait contenir plus d'informations
        let container = link;
        for (let i = 0; i < 5 && container.parentElement; i++) {
          container = container.parentElement;
          if (container.tagName === 'ARTICLE' || 
              container.classList.contains('article') ||
              container.className.includes('article') ||
              container.classList.contains('news-item')) {
            break;
          }
        }
        
        // Créer l'objet article
        articles.push({
          title: text,
          link: link.href,
          image: extractImageUrl(container) || '',
          source: 'Creusot Infos'
        });
      }
      
      // Si on n'a pas trouvé d'articles avec l'approche ci-dessus, 
      // essayons une approche alternative
      if (articles.length === 0) {
        // Rechercher des éléments qui ressemblent à des articles
        const articleElements = Array.from(document.querySelectorAll('.article, article, .news-item, .list-article'));
        
        for (const element of articleElements) {
          // Extraire le titre et le lien
          const titleElement = element.querySelector('h2, h3, h4, .title');
          const linkElement = element.querySelector('a[href*=".html"]');
          
          if (titleElement && linkElement) {
            const title = titleElement.textContent.trim();
            const link = linkElement.href;
            
            if (title.length > 10 && link.includes('/news/faits-divers/') && link.endsWith('.html')) {
              articles.push({
                title,
                link,
                image: extractImageUrl(element) || '',
                source: 'Creusot Infos'
              });
            }
          }
        }
      }
      
      // Éliminer les doublons (basé sur l'URL)
      const uniqueArticles = [];
      const seenUrls = new Set();
      
      for (const article of articles) {
        if (!seenUrls.has(article.link)) {
          seenUrls.add(article.link);
          uniqueArticles.push(article);
        }
      }
      
      return uniqueArticles;
    });
    
    console.log(`Trouvé ${articles.length} articles sur la page principale des faits divers`);
    
    // Si aucun article n'est trouvé directement sur la page principale,
    // c'est peut-être parce qu'elle ne contient que des liens vers des sous-catégories
    // Dans ce cas, nous récupérons les articles les plus récents 
    // depuis toutes les sous-catégories
    let selectedArticles = articles;
    
    if (articles.length === 0) {
      console.log("Aucun article trouvé directement sur la page principale. Recherche dans les sous-catégories...");
      
      // Liste des sous-catégories de faits divers
      const subcategories = [
        "https://www.creusot-infos.com/news/faits-divers/au-creusot/",
        "https://www.creusot-infos.com/news/faits-divers/dans-la-region-du-creusot/",
        "https://www.creusot-infos.com/news/faits-divers/en-saone-et-loire/",
        "https://www.creusot-infos.com/news/faits-divers/en-bourgogne-et-ailleurs/"
      ];
      
      const allSubcategoryArticles = [];
      
      // Visiter chaque sous-catégorie
      for (const subcategoryUrl of subcategories) {
        try {
          console.log(`Visite de la sous-catégorie: ${subcategoryUrl}`);
          await page.goto(subcategoryUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
          });
          
          // Extraire les articles de cette sous-catégorie
          const subcategoryArticles = await page.evaluate(() => {
            function extractImageUrl(element) {
              if (!element) return '';
              const img = element.querySelector('img');
              if (img && img.src) return img.src;
              const style = window.getComputedStyle(element);
              if (style.backgroundImage && style.backgroundImage !== 'none') {
                return style.backgroundImage.replace(/url\(['"]?(.*?)['"]?\)/i, '$1');
              }
              return '';
            }
            
            const articleLinks = Array.from(document.querySelectorAll('a[href*=".html"]'))
              .filter(link => link.href.includes('/faits-divers/'));
            
            const articles = [];
            
            for (const link of articleLinks) {
              const text = link.textContent.trim();
              if (text.length < 10 || 
                  ['lire la suite', 'read more', 'imprimer l\'article'].includes(text.toLowerCase())) {
                continue;
              }
              
              let container = link;
              for (let i = 0; i < 5 && container.parentElement; i++) {
                container = container.parentElement;
                if (container.tagName === 'ARTICLE' || 
                    container.classList.contains('article') ||
                    container.className.includes('article')) {
                  break;
                }
              }
              
              articles.push({
                title: text,
                link: link.href,
                image: extractImageUrl(container) || '',
                source: 'Creusot Infos'
              });
            }
            
            return articles;
          });
          
          console.log(`Trouvé ${subcategoryArticles.length} articles dans la sous-catégorie`);
          allSubcategoryArticles.push(...subcategoryArticles);
          
        } catch (error) {
          console.error(`Erreur lors de la visite de la sous-catégorie ${subcategoryUrl}:`, error);
        }
      }
      
      // Éliminer les doublons par URL
      const uniqueSubcategoryArticles = [];
      const seenUrls = new Set();
      
      for (const article of allSubcategoryArticles) {
        if (!seenUrls.has(article.link)) {
          seenUrls.add(article.link);
          uniqueSubcategoryArticles.push(article);
        }
      }
      
      console.log(`Total de ${uniqueSubcategoryArticles.length} articles uniques trouvés dans les sous-catégories`);
      
      // Utiliser ces articles comme fallback
      selectedArticles = uniqueSubcategoryArticles;
    }
    
    // Limiter aux 5 premiers articles
    selectedArticles = selectedArticles.slice(0, 5);
    
    // Visiter chaque article pour obtenir les dates précises
    for (let i = 0; i < selectedArticles.length; i++) {
      try {
        console.log(`Visite de l'article ${i+1}: ${selectedArticles[i].title}`);
        await page.goto(selectedArticles[i].link, { 
          waitUntil: 'networkidle2', 
          timeout: 20000 
        });
        
        // Capture d'écran pour le premier article
        if (i === 0) {
          await page.screenshot({ path: 'debug-article-page.png', fullPage: false });
        }
        
        // Extraction des informations détaillées de l'article
        const articleData = await page.evaluate(() => {
          // Regarder d'abord au début de la page où se trouve généralement la date
          const dateElements = document.querySelectorAll('.date, time, [class*="date"], [class*="time"]');
          
          for (const element of dateElements) {
            const dateText = element.textContent.trim();
            // Si on trouve une date au format DD/MM/YYYY
            if (dateText.match(/\d{2}\/\d{2}\/\d{4}/)) {
              return { rawDate: dateText };
            }
          }
          
          // Si on ne trouve pas dans les éléments spécifiques, 
          // chercher dans tout le texte de la page
          const pageText = document.body.textContent;
          const dateMatch = pageText.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
          
          if (dateMatch) {
            return {
              day: dateMatch[1],
              month: dateMatch[2],
              year: dateMatch[3],
              hour: dateMatch[4],
              minute: dateMatch[5],
              rawDate: dateMatch[0]
            };
          }
          
          // Si toujours rien, chercher dans le HTML
          const htmlContent = document.documentElement.innerHTML;
          const htmlDateMatch = htmlContent.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
          
          if (htmlDateMatch) {
            return {
              day: htmlDateMatch[1],
              month: htmlDateMatch[2],
              year: htmlDateMatch[3],
              hour: htmlDateMatch[4],
              minute: htmlDateMatch[5],
              rawDate: htmlDateMatch[0]
            };
          }
          
          // Si aucune date n'est trouvée
          return { rawDate: null };
        });
        
        // Construire la date ISO
        if (articleData.day && articleData.month && articleData.year) {
          const date = new Date(
            parseInt(articleData.year),
            parseInt(articleData.month) - 1, // Les mois en JS sont 0-indexés
            parseInt(articleData.day),
            parseInt(articleData.hour || '0'),
            parseInt(articleData.minute || '0')
          );
          selectedArticles[i].date = date.toISOString();
          console.log(`Date trouvée pour l'article ${i+1}: ${articleData.rawDate} -> ${selectedArticles[i].date}`);
        } else if (articleData.rawDate) {
          const parsedDate = parseFrenchDate(articleData.rawDate);
          if (parsedDate) {
            selectedArticles[i].date = parsedDate;
            console.log(`Date brute trouvée pour l'article ${i+1}: ${articleData.rawDate} -> ${selectedArticles[i].date}`);
          } else {
            // Si on ne peut pas parser la date, utiliser une date par défaut
            const defaultDate = new Date(Date.UTC(2025, 3, 8, 18, 40));
            selectedArticles[i].date = defaultDate.toISOString();
            console.log(`Date non parsable pour l'article ${i+1}: ${articleData.rawDate}, utilisation de la date par défaut`);
          }
        } else {
          // Si aucune date n'est trouvée, utiliser une date par défaut
          const defaultDate = new Date(Date.UTC(2025, 3, 8, 18, 40));
          selectedArticles[i].date = defaultDate.toISOString();
          console.log(`Aucune date trouvée pour l'article ${i+1}, utilisation de la date par défaut`);
        }
        
        // Récupérer aussi une meilleure image si disponible
        const imageUrl = await page.evaluate(() => {
          const mainImage = document.querySelector('.article_image img') || 
                           document.querySelector('article img') ||
                           document.querySelector('.content img');
          
          return mainImage ? mainImage.src : null;
        });
        
        if (imageUrl && (!selectedArticles[i].image || selectedArticles[i].image === '')) {
          selectedArticles[i].image = imageUrl;
        }
        
      } catch (error) {
        console.error(`Erreur lors de la visite de l'article ${i+1}:`, error);
        // Date par défaut en cas d'erreur
        const defaultDate = new Date(Date.UTC(2025, 3, 8, 18, 40));
        selectedArticles[i].date = defaultDate.toISOString();
      }
    }

    // Formatage final pour le fichier JSON
    const finalArticles = selectedArticles.map(article => ({
      title: article.title,
      link: article.link,
      image: article.image || '',
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
  if (!dateStr) return null;
  
  try {
    // Format: DD/MM/YYYY HH:MM
    let match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // Les mois en JS sont 0-indexés
      const year = parseInt(match[3], 10);
      const hour = parseInt(match[4], 10);
      const minute = parseInt(match[5], 10);
      
      // On ajoute 2 heures (fuseau horaire français en été)
      const date = new Date(Date.UTC(year, month, day, hour, minute));
      
      // L'heure locale française est UTC+2 en été
      // donc on doit ajouter 2h pour que 05:17 en France soit aussi 05:17 en UTC
      date.setUTCHours(date.getUTCHours() + 2);
      
      return date.toISOString();
    }
    
    // Format: DD/MM/YYYY
    match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const year = parseInt(match[3], 10);
      
      const date = new Date(Date.UTC(year, month, day, 0, 0));
      // Même ajustement +2h
      date.setUTCHours(date.getUTCHours() + 2);
      
      return date.toISOString();
    }
    
    return null;
  } catch (e) {
    console.error("Erreur lors du parsing de la date:", dateStr, e);
    return null;
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
