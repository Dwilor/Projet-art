# Sirius — La matière, en équilibre.

Portfolio marchand francophone réalisé à partir du brief fourni le 8 octobre 2026. React 19, Vite, rendu HTML côté serveur avec Express et stockage SQLite (Node.js 24). Cette base appartient au dépôt et ne dépend d’aucun compte personnel du développeur.

## Consulter le site

[Ouvrir l’aperçu Sirius](https://sirius-preview.onrender.com).

L’aperçu est hébergé sur Render et suit la branche `main` de ce dépôt. Les ventes restent désactivées. Sur la formule gratuite, le service peut se mettre en veille : son premier chargement peut prendre environ une minute. Les données enregistrées utilisent un disque éphémère. Consulter [les détails de l’hébergement](DEPLOY_RENDER.md) avant de publier un catalogue marchand.

## Démarrer

```bash
cd /workspace/Projet-art
npm ci
npm run dev
```

Le serveur écoute sur le port 3000 et le développement bénéficie du rechargement à chaud. La machine cloud est déjà isolée : utiliser ce checkout, sans créer de worktree.

```bash
npm run build
npm start
```

Le build produit le client dans `dist/client` et le rendu serveur dans `dist/server`. Le serveur de production sert les fichiers statiques et les pages indexables. `PORT` permet de changer le port. `npm run dev` et `npm start` chargent le fichier `.env` lorsqu’il existe ; les variables injectées par l’hébergement restent prioritaires.

## Direction artistique et contenus

Palette exacte : crème `#F3EEE4`, encre `#282923`, terracotta `#A95535`, olive `#72745B`, sable `#D5C5AA`. Polices originales auto-hébergées : Latin Modern Roman, Nimbus Sans et Nimbus Sans Narrow. Leurs licences figurent dans `public/fonts/licenses`. Le symbole SVG reprend les tracés du brief.

Les cinq images sont extraites du document Word, sans modification de la composition. Les vues complètes conservent le ratio 1122 × 1402. Des versions WebP à 480, 800 et 1122 pixels sont fournies, avec fallback PNG. Seules les séquences explicitement identifiées comme détails sont recadrées. L’image d’ouverture est prioritaire ; les autres images sont chargées à la demande.

L’accueil respecte l’ordre : ouverture, originaux, matière, reproductions, démarche, contact, pied de page. Navigation clavier, menu mobile avec retour du focus après Échap, galerie agrandie et réduction des mouvements sont inclus. Aucun réseau social, témoignage, prix ou information commerciale n’a été inventé.

Le portrait « Artiste 1.png » mentionné dans le brief n’était pas inclus dans le document : la biographie utilise une œuvre comme visuel éditorial, sans la présenter comme un portrait. Les références ART-001 à ART-005 restent provisoires.

## Préproduction et catalogue

`SITE_MODE=preview` par défaut : toutes les pages sont `noindex`, et les cinq compositions peuvent être explorées comme aperçu éditorial. Les produits correspondants sont **en brouillon**, sans titre, prix, dimensions ou stock inventés. `/api/catalog` n’expose jamais les produits en brouillon ou archivés. En mode `live`, les fiches non publiées renvoient une 404.

Routes : `/`, `/originaux`, `/reproductions`, `/originaux/:slug`, `/reproductions/:slug`, `/a-propos`, `/contact`, `/panier`, `/commande`, `/commande/resultat`, `/livraison-retours`, `/mentions-legales`, `/cgv`, `/confidentialite` et `/admin`.

Une fiche informative nécessite un titre et une vue complète. Une fiche disponible exige en plus des caractéristiques, un prix public positif en centimes EUR, un stock réel et une livraison configurée. Chaque original a un stock maximal de 1. Chaque format de reproduction conserve son prix, son stock, ses dimensions, son papier, son procédé et la validation de son épreuve. Les hypothèses HT du simulateur ne sont pas importées comme prix TTC.

## Voir l’œuvre chez moi

Le simulateur est accessible depuis « Chez vous » dans la navigation, les fiches des œuvres et [la page publique](https://sirius-preview.onrender.com/chez-moi). Importer une photo de son intérieur, choisir une composition, puis la déplacer avec la souris, au doigt ou avec les flèches du clavier. La poignée et le curseur ajustent sa taille ; « Recentrer » conserve cette taille. L’aperçu peut être téléchargé en JPG.

Les photos JPG, PNG, WebP et AVIF sont décodées et préparées uniquement dans le navigateur, avec prise en compte de l’orientation de l’appareil. Elles ne sont ni envoyées au serveur ni enregistrées dans le stockage du navigateur. Les URL temporaires sont libérées lors d’un remplacement, d’un retrait ou d’une sortie du simulateur. L’import accepte au maximum 20 Mo et 50 mégapixels, puis réduit le côté le plus long à 2560 pixels pour limiter la mémoire utilisée.

En production, la sélection contient les originaux et variantes de reproduction en stock. Les formats reprennent leurs dimensions publiées, en conservant l’image entière. En préproduction, les compositions éditoriales proposent trois tailles d’aperçu sans dimensions commerciales inventées. L’échelle dans une photo non calibrée reste indicative ; un mur photographié de face donne une meilleure lecture des proportions.

`npm run test:room` vérifie l’import privé, les fichiers invalides, l’orientation EXIF, les formats, les mouvements et redimensionnements, le tactile, le clavier, l’export, l’accessibilité et l’affichage responsive avec des données de recette isolées.

## Administration

L’espace `/admin` permet de créer et modifier les fiches, publier ou archiver, sélectionner jusqu’à trois originaux pour l’accueil, importer les médias, gérer les variantes, la biographie, les informations légales, les destinations et frais de livraison. Il permet de consulter les contacts et commandes, réessayer les envois de contact, enregistrer une expédition, rembourser une commande de test et exporter produits, contacts et commandes en JSON.

Configurer `ADMIN_PASSWORD` avec un mot de passe propre au propriétaire, dans les paramètres sécurisés de l’hébergement ou dans un `.env` local ignoré par Git. Sans cette variable, un mot de passe aléatoire est créé dans `.data/admin-password` (permissions 600). Consulter ce fichier localement pour accéder à cette instance ; sa valeur n’est jamais affichée dans les logs ou la documentation. L’accès est protégé par une session HttpOnly, SameSite Strict, limitée à huit heures. Les requêtes d’écriture sont vérifiées et les tentatives de connexion limitées. Utiliser HTTPS en déploiement ; les cookies sont Secure lorsque `SITE_URL` commence par `https://` ou si `COOKIE_SECURE=true`.

Les imports sont limités à PNG, JPEG, WebP et AVIF non animés, 20 Mo / 40 mégapixels. Les images sont décodées puis réencodées, avec noms générés, suppression des métadonnées et versions responsives. Aucun fichier SVG ou document exécutable ne peut être chargé dans les médias.

## Contact et e-mails

Le contact est validé côté navigateur et serveur, avec honeypot et limitation des tentatives. Les messages sont enregistrés dans SQLite. Sans SMTP configuré, le site confirme **l’enregistrement**, en indiquant que l’envoi d’e-mail est indisponible. Il ne prétend pas avoir envoyé un message.

Configurer les variables de `.env.example` pour un serveur SMTP avec TLS vérifié : `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`, `CONTACT_EMAIL`. Le succès d’envoi n’est affiché qu’après acceptation réelle par le serveur SMTP. Les échecs sont journalisés et peuvent être relancés depuis l’administration.

Les confirmations après paiement vérifié, notifications vendeur, expéditions et remboursements utilisent une file persistante, avec identifiants uniques et cinq tentatives maximum. Aucune inscription commerciale automatique. Vérifier la réception réelle chez le destinataire avant publication ; la configuration de messagerie n’était pas fournie et cette livraison externe reste à tester.

## Paiement de test et livraison

Configurer `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` et `SITE_URL`. Le compte Stripe est vérifié via son API : seuls les comptes en mode test sont acceptés, y compris avec une authentification injectée par proxy. Une clé réelle ne permet pas d’encaissement dans cette version. Il faut ensuite compléter les informations commerciales et activer la vente de test dans l’administration.

Configurer la notification signée `/api/payment/webhook` pour `checkout.session.completed` et `checkout.session.expired`. Les données de carte ne transitent jamais par ce site. Le retour du navigateur ne confirme pas une vente : seul le webhook signé, avec vérification du montant, de la devise et de la session, confirme la commande. Une répétition de notification ne diminue pas deux fois le stock.

La commande fige les titres, prix, formats, quantités, traitement fiscal, adresse et frais. Elle recalcule le total côté serveur et refuse un montant différent du récapitulatif accepté. Les prix publics configurés doivent déjà inclure le traitement fiscal applicable : ne jamais importer les montants HT du simulateur comme TTC. Aucun moteur fiscal international n’est configuré. La première configuration de livraison utilise un tarif fixe configurable par commande ; elle n’annonce ni gratuité ni livraison mondiale. Les barèmes par poids ou par catégorie nécessitent une extension avant utilisation.

Les réservations sont atomiques (transaction SQLite) et expirent après **30 minutes**, durée minimale compatible avec Stripe Checkout, plutôt que les 15 minutes proposées dans le brief. Une annulation libère le stock après expiration confirmée de la session de paiement. Une destination absente de la liste autorisée est bloquée avant paiement. Un retour tardif de paiement après libération nécessite une vérification manuelle, sans confirmer automatiquement une deuxième vente.

Les remboursements sont effectués via Stripe en mode test. Le stock n’est réintégré que lorsque l’administrateur indique que le retour a été contrôlé. Toute demande de retour peut être reçue par le contact et suivie avec sa référence de commande. L’historique des modifications de commande et de stock est conservé. Le propriétaire doit disposer de ses comptes Stripe, messagerie et hébergement.

Le parcours hébergé, ses refus et abandon, la signature d’un webhook externe et la réception des e-mails **n’ont pas été testés contre des comptes externes**, faute de configuration. Le moteur de réservation, les montants, l’idempotence et les stocks sont testés localement. Les paiements réels restent désactivés ; leur ouverture est une étape distincte après recette commerciale et juridique.

## Vérifications

```bash
npm test
npm run build
npm run test:e2e
```

Les tests unitaires couvrent les brouillons, les exigences de publication, les montants, le stock unique, les réservations expirées, les lignes dupliquées, les variantes, les prix figés, les notifications répétées, la file de messagerie, l’expédition et les remboursements.

La recette navigateur utilise Chromium (`CHROMIUM_PATH` permet de choisir l’exécutable) et Playwright. Elle teste quinze routes à 360, 390, 768 et 1440 px, les erreurs JavaScript, les polices, les proportions, le focus du menu, le zoom, les filtres, le contact, l’accès privé, les brouillons et l’import de médias. Axe vérifie cinq pages représentatives. Ce contrôle automatisé ne constitue pas une certification WCAG. Captures dans `test-results`, ignoré par Git.

Les objectifs LCP ≤ 2,5 s, CLS ≤ 0,1 et INP ≤ 200 ms restent à mesurer sur l’hébergement réel, avec appareils et réseaux représentatifs. Aucun résultat local ne garantit ces objectifs en production.

## Données, sauvegardes et exploitation

SQLite, les médias importés, la file de messagerie et le journal d’audit sont conservés dans `.data` (ou `DATA_DIR`), à placer sur un volume persistant. Ne jamais versionner ce répertoire ni les secrets. Les processus et sessions ne survivent pas à un redémarrage ; les données persistent.

```bash
npm run backup
```

Cette commande crée une sauvegarde cohérente de SQLite et vérifie son intégrité. Conserver aussi les médias de `.data/media` et les originaux dans `public/images`. Pour restaurer : arrêter le serveur, conserver l’ancien répertoire, restaurer une sauvegarde SQLite comme `.data/sirius.sqlite` avec ses médias, puis redémarrer. La sauvegarde locale et son ouverture ont été vérifiées. Planifier des sauvegardes régulières et une copie hors machine sur l’hébergement choisi ; un volume local seul ne protège pas contre la perte de la machine.

Les coûts récurrents dépendent de l’hébergement, du domaine, de la messagerie et des frais du prestataire de paiement, à choisir et contractualiser au nom de Sirius. La maintenance inclut mises à jour, sauvegardes, contrôle des erreurs de paiement et de messagerie, et vérification des textes légaux lors de tout changement commercial. Aucun tarif ni abonnement n’est supposé dans ce dépôt.

Avant publication : fournir titres et fiches réelles, prix publics et régime fiscal, stock, épreuves des prints, portrait, identité légale, CGV et confidentialité, pays, tarifs et délais, comptes du propriétaire. Aucun traceur publicitaire ou analytique n’est chargé ; le stockage local sert uniquement au panier, sans bandeau artificiel.
