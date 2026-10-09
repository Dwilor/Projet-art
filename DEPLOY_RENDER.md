# Aperçu Sirius sur Render

L’aperçu est disponible sur [sirius-preview.onrender.com](https://sirius-preview.onrender.com). Le service [sirius-preview dans Render](https://dashboard.render.com/web/srv-db49lujbc2fs73b3v510) utilise la formule gratuite en région Frankfurt, Node.js 24.19.0, et le dépôt `Dwilor/Projet-art`, branche `main`. Les nouveaux commits déclenchent automatiquement un déploiement.

La configuration `render.yaml` décrit cet aperçu. Le build est `npm ci --no-audit --no-fund && npm run build` et le démarrage est `npm start`. Le contrôle de disponibilité est `/api/health` et renvoie `{"status":"ok","mode":"preview"}`.

Les ventes restent désactivées. Aucun prix, stock, pays de livraison ou secret n’est inventé. Render génère le mot de passe de l’administration ; celui-ci reste dans ses paramètres sécurisés.

La formule gratuite utilise un disque éphémère : les messages et modifications du catalogue peuvent disparaître lors d’un redémarrage. Le service peut aussi se mettre en veille, avec un premier chargement d’environ une minute. Elle convient à un aperçu du site. Pour exploiter la boutique et conserver les données, un hébergement avec stockage persistant devra être configuré séparément. Aucun service payant n’a été créé.

L’automatisation du déploiement nécessite une clé API du compte Render du propriétaire, accessible sous le nom `RENDER_API_KEY` dans les paramètres sécurisés de l’environnement cloud et autorisée uniquement vers `api.render.com`. Cette clé sert à piloter Render ; elle ne doit être placée ni dans GitHub ni dans les variables du site publié. Si le dépôt est privé, le compte Render doit aussi disposer de son accès GitHub.

Le déploiement a été vérifié le 9 octobre 2026 : les quinze pages publiques répondent, le contrôle de disponibilité confirme le mode aperçu et les données d’administration exigent une authentification. Les captures desktop et mobile sont conservées localement dans `test-results/render-desktop.png` et `test-results/render-mobile.png`.
