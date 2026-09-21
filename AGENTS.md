# Instructions pour les agents

Ce fichier s'applique à l'ensemble du projet. Il complète le `README.md`,
`CMS.md` et `CONTRIBUTING.md` sans les remplacer. Ce dépôt public contient le
code du site, pas les secrets, les données ni l'infrastructure de production.
Le déploiement est géré séparément dans un dépôt privé.

## Objectif du projet

Wolves Toulouse est un site français de cheerleading construit avec Nuxt 4 et
doté d'un CMS éditorial intégré. Préserver en priorité :

1. la justesse des contenus et des parcours ;
2. l'accessibilité, le SEO et le rendu SSR ;
3. les performances et le responsive ;
4. l'identité visuelle propre au club.

Ne pas transformer le projet en application générique ou en assemblage de
composants de bibliothèque.

## Socle technique

- Nuxt 4, Vue 3, TypeScript strict, ESM et Nitro.
- Respecter les versions LTS de Node.js autorisées par `package.json`. La
  version locale de référence est 22.19 dans `.nvmrc`.
- pnpm 11.9.0 est le seul gestionnaire de paquets attendu.
- ESLint contrôle la qualité du code ; Prettier possède le formatage.
- L'interface utilise Vue et du CSS natif, sans bibliothèque UI.

Commandes usuelles :

```bash
nvm use
corepack enable
pnpm install --frozen-lockfile
pnpm dev
pnpm check
pnpm check:all
pnpm build
```

Ne pas utiliser npm ou Yarn et ne pas créer d'autre lockfile. Toute modification
de dépendances doit mettre à jour `package.json` et `pnpm-lock.yaml` ensemble.
Ne pas modifier le lockfile à la main. Le script `postinstall` exécute
`nuxt prepare` et génère notamment la configuration ESLint sous `.nuxt/`.

## Carte du projet

- `app/pages/` : routes publiques légères et interface `/admin`.
- `app/components/cms/` : rendu public et champs d'édition des blocs CMS.
- `app/composables/` : chargement CMS, SEO et données structurées partagés.
- `shared/cms/` : types, registre des blocs et validation des contenus.
- `server/data/cms-seed.ts` : contenu initial appliqué uniquement à une base
  vide ; `app/data/site.ts` alimente encore certaines valeurs de ce seed.
- `server/utils/cms/` : migrations SQLite et accès transactionnels aux données.
- `server/api/cms/` et `server/api/admin/` : lectures publiques et mutations
  protégées du CMS.
- `.data/` en local, `/data` en Docker : base SQLite et médias persistants,
  toujours exclus de Git.
- `app/assets/css/main.css` : styles globaux, tokens et responsive.
- `public/` : images, vidéo, manifeste et ressources publiques.
- `server/routes/` : OAuth Discord, médias, healthcheck, robots.txt et sitemap.
- `server/utils/registrations/` : protocole HMAC et client du bridge BigBadBot
  pour les disponibilités et actions membre en temps réel.
- `shared/training-announcements/` et `app/pages/admin/annonces.vue` : contrat,
  validation et interface des annonces structurées ; BigBadBot possède leur
  persistance, leur planification et leur publication Discord.
- `shared/animation-events/`, `app/pages/admin/evenements.vue` et
  `app/components/admin/AnimationGroupPlanner.vue` : annonces d’animation,
  réactions historiques et plans de groupes ; BigBadBot reste la source de
  vérité et Nuxt ne reçoit que des clés de participant opaques.
- `nuxt.config.ts` : runtime config, sécurité et rendu Nitro dynamique.

`app/app.vue` fournit déjà le lien d'évitement, `AppHeader`, l'unique
`<main id="contenu">` et `AppFooter`. Ne pas dupliquer ce shell dans une page.

Ne jamais modifier manuellement `.nuxt/`, `.output/`, `dist/` ou
`node_modules/`. Ce sont des sorties générées ou des dépendances.

## Méthode de travail

- Lire les fichiers concernés et rechercher un motif existant avant de coder.
- Faire une modification ciblée ; préserver les changements sans rapport déjà
  présents dans le dossier.
- Réutiliser un composant, un type, un token CSS ou un composable existant avant
  d'en créer un nouveau.
- La source de vérité du contenu au runtime est SQLite. Centraliser les
  informations communes dans les réglages CMS et les contenus de page dans
  leurs blocs. Ne pas copier les mêmes coordonnées, liens, équipes ou textes
  structurants dans plusieurs blocs.
- Traiter `server/data/cms-seed.ts` et `app/data/site.ts` comme des valeurs
  d'initialisation : leur modification ne met pas à jour une base existante.
  Prévoir une migration explicite pour toute transformation de données déjà
  déployées.
- Ne pas inventer de noms, dates, résultats, liens, mentions légales ou
  informations sur le club. Signaler toute donnée manquante.
- Éviter une nouvelle dépendance de production lorsqu'une API Nuxt, Vue, Web ou
  quelques lignes de code maintenables suffisent. Expliquer toute dépendance
  ajoutée.
- Ne jamais déployer, modifier l'infrastructure distante ou manipuler un secret
  sans demande explicite.

## Conventions Nuxt et TypeScript

- Utiliser `<script setup lang="ts">`, la Composition API et les auto-imports
  Nuxt déjà en place.
- Conserver des types explicites aux frontières du code. Éviter `any`, les
  assertions non justifiées et `@ts-ignore`.
- Nommer les composants Vue en PascalCase et les composables avec le préfixe
  `use`.
- Garder le code compatible SSR : ne pas lire `window`, `document`, le stockage
  navigateur ou une API DOM pendant le rendu serveur.
- Éviter tout rendu initial dépendant d'une valeur aléatoire, de l'heure locale
  ou d'un état uniquement client afin de prévenir les erreurs d'hydratation.
- Nettoyer dans `onBeforeUnmount` tout listener, classe globale ou autre effet
  installé par une interaction côté client.
- Utiliser `useRuntimeConfig()` pour les valeurs d'environnement. Les secrets
  restent dans la partie privée ; seules les valeurs destinées au navigateur
  vont sous `runtimeConfig.public`.
- Respecter les conventions de routage par fichiers de Nuxt. Ne pas ajouter un
  routeur manuel.
- Ne pas désactiver une règle ESLint, TypeScript ou Prettier uniquement pour
  faire passer une vérification ; corriger la cause ou documenter précisément
  l'exception.

## Interface, contenu et accessibilité

- Conserver le ton français du site et sa typographie, notamment les accents et
  apostrophes correctes.
- Réutiliser les variables CSS et les conventions de classes de
  `app/assets/css/main.css` avant d'ajouter une nouvelle valeur brute.
- Placer les styles globaux dans la couche CSS appropriée (`reset`, `base`,
  `components` ou `utilities`) et conserver les conventions de nommage de
  classes existantes.
- Vérifier au minimum les largeurs mobile et bureau lors d'une modification de
  mise en page. Éviter les dimensions fixes qui créent un débordement.
- Préserver une structure HTML sémantique, un seul titre principal par page,
  l'ordre logique des titres et la navigation au clavier.
- Tout contrôle interactif doit avoir un nom accessible, un focus visible et un
  comportement clavier cohérent. Ne pas remplacer un bouton par un `div`
  cliquable.
- Utiliser `NuxtLink` pour la navigation interne. Pour un lien externe ouvert
  dans un nouvel onglet, ajouter `rel="noopener noreferrer"`.
- Respecter `prefers-reduced-motion` pour toute animation non essentielle.
- Pour les images de contenu, fournir un texte alternatif utile ainsi que les
  dimensions afin de limiter les décalages de mise en page. Charger paresseusement
  les médias hors écran ; réserver le préchargement aux ressources réellement
  critiques.
- Préserver l'esthétique existante : marine, indigo, orange, typographie Raleway
  et titres display. Ne pas introduire un nouveau langage visuel sans demande.

## SEO, routes et données structurées

- Chaque page CMS doit fournir un titre SEO, une description et un chemin
  cohérents ; `CmsRoutePage` les transmet à `usePageSeo()`. Ne jamais coder le
  domaine public en dur.
- Utiliser les composables SEO existants plutôt que de dupliquer les balises
  canonical, Open Graph ou Twitter.
- Conserver les données structurées de l'organisation cohérentes avec
  les réglages CMS et leur seed.
- Garder les pages légales en `noindex` et hors du sitemap tant que leur contenu
  n'est pas finalisé. La page d'erreur reste en `noindex, nofollow`.
- Lorsqu'une route publique est ajoutée, supprimée ou renommée, vérifier et
  synchroniser selon le besoin :
  - la page, la navigation et le pied de page dans SQLite et leur seed ;
  - la route légère correspondante sous `app/pages/` ;
  - le sitemap dynamique, qui doit inclure les révisions publiées indexables ;
  - les liens internes et la documentation.
- Les pages légales peuvent être exclues de la navigation principale, mais
  doivent rester accessibles depuis le pied de page.

## Serveur, sécurité et données

- Ne jamais committer de secret ni de fichier `.env`. Maintenir `.env.example`
  avec des valeurs fictives et documentées.
- Ne jamais committer de base SQLite, d'export de participants, de journal
  nominatif, de sauvegarde, de configuration opérationnelle ni d'identifiant
  privé. Les tests utilisent uniquement des données fictives.
- BigBadBot est un service privé non fourni avec ce dépôt. Ne pas contourner
  une autorisation ni demander des secrets de production pour développer une
  fonctionnalité qui en dépend.
- `/healthz` doit rester accessible sans authentification pour le healthcheck
  Docker. Il doit continuer à vérifier SQLite, l'écriture des médias et la
  configuration privée requise en production sans exposer leur détail.
- Les pages CMS ne doivent pas être prérendues : une publication doit être
  visible sans rebuild.
- La production déploie le serveur Nitro issu de `pnpm build`, pas la sortie
  statique de `pnpm generate`.
- Le conteneur de production utilise un système de fichiers en lecture seule.
  Seuls `/tmp` pour les téléversements temporaires et le volume `/data` pour
  SQLite et les médias sont inscriptibles. Ne jamais écrire ailleurs au runtime.
- Préserver le montage persistant de `/data`, sa propriété par l'utilisateur
  non privilégié et sa sauvegarde. Ne jamais utiliser `docker compose down -v`
  en production.
- L'authentification CMS repose sur Discord OAuth2 et le scope `identify`.
  Autoriser les comptes par leur ID Discord numérique immuable, jamais par leur
  pseudonyme ou nom affiché. Le super administrateur doit correspondre à
  `NUXT_CMS_SUPER_ADMIN_DISCORD_ID` dans la configuration privée.
- L'espace membre résout toujours sa propre projection BigBadBot depuis l'ID de
  session. Ne jamais accepter un ID membre dans la query, exposer la base brute
  du bot au serveur web ou retourner l'ID Discord dans la réponse publique.
- Les inscriptions et alertes passent uniquement par le bridge BigBadBot du
  réseau Docker privé. Signer chaque appel côté serveur, revérifier les
  permissions Discord et la capacité dans le bot, et ne jamais appeler ce
  bridge directement depuis le navigateur.
- L'accès aux annonces d'entraînement est une capacité opérationnelle séparée
  des rôles CMS. BigBadBot doit revérifier à chaque opération l'ID numérique du
  rôle Head Coach ou l'ID privé du super administrateur. Nuxt ne doit jamais
  planifier lui-même une publication ni manipuler le token Discord.
- Les événements d’animation suivent la même capacité opérationnelle. Le salon,
  l’auteur historique, les rôles et les équipes doivent être résolus par leurs
  IDs Discord côté BigBadBot. Ne jamais exposer les IDs membres au navigateur,
  inventer les timestamps d’un import ancien, fusionner deux emojis ou retirer
  automatiquement d’un groupe une personne qui a annulé sa réaction.
- Ne jamais placer le Client Secret Discord, le mot de passe de session ou l'ID
  privé du super administrateur dans `runtimeConfig.public`.
- Ne pas affaiblir les en-têtes de sécurité définis dans `nuxt.config.ts` sans
  justification explicite.
- `compose.yaml` décrit uniquement un environnement local. Toute modification
  du Dockerfile ou de Nitro doit préserver les contrats de stockage et de
  sécurité ; elle n'autorise aucun accès à l'infrastructure de production.
- Ce dépôt public est destiné aux contributions au code du site. Le volume de
  données est la source de vérité du contenu CMS de chaque environnement. Ne
  jamais récupérer ni modifier un environnement distant sans demande explicite.
- Ne pas ajouter de secret, de runner auto-hébergé ou de workflow de déploiement
  au dépôt public. La liaison automatique au déploiement privé n'est pas encore
  raccordée ; ne pas la présenter comme opérationnelle.
- L'ajout d'un outil de mesure d'audience ou d'un traceur exige de mettre à jour
  la politique de confidentialité et, si nécessaire, le consentement avant sa
  mise en service.

## Vérifications obligatoires

Avant de rendre une modification de code :

```bash
pnpm check
```

Ajouter les contrôles proportionnés au changement :

- page, composant, style ou contenu partagé : `pnpm check` ;
- route, SEO ou sitemap : `pnpm check:all` ;
- serveur, middleware, Nuxt config, dépendance ou déploiement : `pnpm check` puis
  `pnpm build` ;
- Docker ou Compose local : ajouter `docker compose config --quiet` ;
- correction automatique nécessaire : `pnpm lint:fix` puis `pnpm format`, avant
  de relancer `pnpm check`.

Si un contrôle ne peut pas être exécuté, l'indiquer clairement dans le compte
rendu final avec la raison. Ne jamais présenter une vérification non exécutée
comme réussie.

Des tests Vitest couvrent notamment les migrations, le dépôt CMS, la validation
des blocs et le traitement des images. Ne déclarer leur réussite qu'après avoir
réellement exécuté `pnpm test` ou `pnpm check`, et citer la commande utilisée.

## Compte rendu attendu

- Résumer le résultat utilisateur, pas seulement les fichiers touchés.
- Lister les vérifications réellement exécutées et leur résultat.
- Signaler les hypothèses, données à confirmer et risques résiduels.
- Ne pas inclure de secret, de contenu de `.env` ou d'identifiant de production
  dans le compte rendu.

## Code Review Rules

Lors d'une revue, signaler en priorité :

- une régression SSR ou une divergence d'hydratation ;
- une route publiée absente du sitemap ou une page CMS prérendue par erreur ;
- un canonical, une URL publique ou une donnée structurée incorrecte ;
- une régression clavier, focus, contraste, texte alternatif ou hiérarchie des
  titres ;
- un secret exposé ou une valeur privée placée dans `runtimeConfig.public` ;
- une modification qui protège `/healthz` ou contourne une autorisation ;
- une perte de persistance de `/data`, une migration SQLite non sûre ou une
  restauration qui sépare la base de ses médias ;
- une autorisation fondée sur un pseudonyme Discord plutôt que sur l'ID
  numérique privé ;
- un risque de rupture du build, du serveur Nitro ou du déploiement Docker.

Ne pas remonter comme anomalie une préférence de formatage déjà prise en charge
par ESLint ou Prettier.
