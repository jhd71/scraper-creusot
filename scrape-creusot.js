const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeCreusotInfos() {
  // Lancer le navigateur (options adaptées pour GitHub Actions)
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Aller sur la page de listing des articles
  const listingUrl = 'https://www.creusot-infos.com/news/faits-divers/';
  await page.goto(listingUrl, {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  // Extraire les URLs des articles depuis la page de listing.
  // Adaptez le sélecteur ci-dessous en fonction de la structure du listing.
  // Par exemple, ici nous cherchons tous les liens dans des blocs ayant la classe "news-item".
  const articleLinks = await page.evaluate(() => {
    const links = [];
    // Cherche tous les éléments qui contiennent un lien vers un article.
    // Vous devez adapter ce sélecteur selon le HTML réel du listing.
    const items = document.querySelectorAll('.news-item a');
    items.forEach(linkEl => {
      // On s'assure de récupérer des URLs valides.
      if (linkEl && linkEl.href) {
        links.push(linkEl.href);
      }
    });
    return links;
  });

  if (!articleLinks.length) {
    console.error("Aucun lien trouvé sur le listing.");
    await browser.close();
    return;
  }

  console.log("Articles à traiter :", articleLinks.slice(0, 5));

  // Initialiser un tableau pour stocker les articles
  const results = [];
  // Vous pouvez limiter par exemple aux 5 premiers articles
  for (const url of articleLinks.slice(0, 5)) {
    const articlePage = await browser.newPage();
    try {
      await articlePage.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      // Optionnel : ajouter un délai si le contenu se charge lentement
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Attendre l'élément contenant la date dans la page détaillée
      await articlePage.waitForSelector('div.newsFullPubli', { timeout: 30000 });

      // Extraire les données de l'article
      const articleData = await articlePage.evaluate(() => {
        // Sélectionner les éléments contenant les informations
        const titleEl = document.querySelector('.newsFullTitle');
        const imageEl = document.querySelector('img.newsFullImg');
        const dateEl = document.querySelector('div.newsFullPubli');
        // Utiliser le lien canonique s'il est présent, sinon la page actuelle
        const canonicalLink = document.querySelector('link[rel="canonical"]');
        const link = canonicalLink ? canonicalLink.href : document.location.href;
        
        const title = titleEl ? titleEl.textContent.trim() : '';
        const image = imageEl ? imageEl.src : '';
        const dateText = dateEl ? dateEl.textContent.trim() : '';

        // Conversion du format "DD/MM/YYYY HH:mm" en format ISO "YYYY-MM-DDTHH:mm:00"
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
          title,
          link,
          image,
          date: isoDate,
          source: 'Creusot Infos'
        };
      });

      // On vérifie que toutes les données essentielles ont été récupérées
      if (articleData.title && articleData.link && articleData.image && articleData.date) {
        results.push(articleData);
      } else {
        console.warn("Données incomplètes pour l'article :", url);
      }
      
      await articlePage.close();
    } catch (error) {
      console.error("Erreur sur l'article", url, error);
      await articlePage.close();
    }
  }

  // Écrire les résultats dans le fichier JSON
  await fs.promises.writeFile('data/articles.json', JSON.stringify(results, null, 2));
  await browser.close();
  console.log("✅ Scraping terminé. Articles extraits :", results.length);
}

scrapeCreusotInfos().then(() => {
  console.log("✅ Processus terminé.");
});
