# 📰 Scraper Creusot Infos

![Scraping Workflow](https://github.com/jhd71/scraper-creusot/actions/workflows/scrape.yml/badge.svg)
![Dernière mise à jour](https://img.shields.io/github/last-commit/jhd71/scraper-creusot?label=Dernière%20mise%20à%20jour&color=blue)

Ce projet utilise **Puppeteer** pour scraper automatiquement les dernières actualités publiées dans la section "Faits Divers" du site [Creusot Infos](https://www.creusot-infos.com/news/faits-divers/).

Les résultats sont enregistrés sous forme de fichier JSON dans :  
📁 `data/articles.json`

---

## ⚙️ Fonctionnement

- Le script `scrape-creusot.js` récupère les 5 derniers articles avec :
  - Le titre
  - L’image
  - Le lien vers l’article
  - La date du scraping
  - La source (Creusot Infos)

- Le workflow GitHub Actions s’exécute automatiquement :
  - 🕒 Toutes les heures (`cron`)
  - Ou manuellement depuis l’onglet **Actions**
  - ✅ Résultats commités automatiquement dans le dépôt

---

## 🚀 Technologies utilisées

- [Node.js](https://nodejs.org/)
- [Puppeteer](https://pptr.dev/)
- [GitHub Actions](https://github.com/features/actions)

---

## 🧠 Idées futures

- 🔍 Filtrer par mots-clés ou catégories
- 🌐 Intégrer les articles à un site web ou une API
- 💾 Historique des articles dans une base de données

---

> 📬 Contact : [infos71@free.fr](mailto:infos71@free.fr)
