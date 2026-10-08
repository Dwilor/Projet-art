# Aperçu Sirius sur Render

La configuration `render.yaml` prépare un service Node.js 24 en formule gratuite, pour consulter le site en préproduction. Le dépôt cible est `Dwilor/Projet-art`, branche `main`. Le build et le démarrage correspondent aux commandes déjà vérifiées dans le cloud. Le contrôle de disponibilité est `/api/health`.

Les ventes restent désactivées. Aucun prix, stock, pays de livraison ou secret n’est inventé. Render génère le mot de passe de l’administration ; celui-ci reste dans ses paramètres sécurisés.

La formule gratuite utilise un disque éphémère : les messages et modifications du catalogue peuvent disparaître lors d’un redémarrage. Elle convient à un aperçu du site. Pour exploiter la boutique et conserver les données, un hébergement avec stockage persistant devra être configuré séparément. Aucun service payant n’est créé par cette préparation.

L’automatisation du déploiement nécessite une clé API du compte Render du propriétaire, accessible sous le nom `RENDER_API_KEY` dans les paramètres sécurisés de l’environnement cloud et autorisée uniquement vers `api.render.com`. Cette clé sert à piloter Render ; elle ne doit être placée ni dans GitHub ni dans les variables du site publié. Si le dépôt est privé, le compte Render doit aussi disposer de son accès GitHub.

Étapes de l’agent après fourniture de cet accès : vérifier le compte Render et ses services existants, publier le code sur GitHub lorsque l’accès en écriture est autorisé, créer le service gratuit, suivre le build, récupérer son adresse officielle et vérifier l’accueil, les images et `/api/health`. Ne jamais présenter une adresse supposée comme une URL de déploiement validée.
