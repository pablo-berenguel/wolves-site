# Wolves Toulouse Cheerleading

Code du site des Wolves Toulouse, construit avec Nuxt 4 et doté d'un CMS
éditorial intégré. Le rendu public est SSR ; les pages, leurs blocs, les
réglages communs et les médias peuvent être gérés depuis `/admin` sans
reconstruire l'application.

Ce dépôt public démarre avec un historique neuf. Il accueille le développement
du site et les contributions par pull request. Il ne contient ni données CMS
de production, ni secrets, ni infrastructure de déploiement. La production est
gérée séparément dans un dépôt privé : une contribution ici ne donne aucun
accès à ses serveurs ou à ses secrets. La synchronisation automatique vers ce
dépôt privé n'est pas encore raccordée.

## Socle technique

- Nuxt 4, Vue 3, TypeScript strict et serveur Nitro ;
- Vue et CSS natifs, sans bibliothèque UI ;
- SQLite avec révisions de brouillon et publication explicite ;
- connexion à l'administration par OAuth2 Discord ;
- traitement des images par Sharp en variantes WebP adaptées aux blocs ;
- ESLint, Prettier, typecheck Nuxt et tests Vitest.

## Démarrage local

Prérequis : une version de Node.js autorisée par `package.json` (`.nvmrc`
fournit la version de référence) et pnpm 11.9.0.

```bash
nvm use
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
```

Adapter ce fichier `.env` local avant de démarrer. Pour travailler sur le site
sans mesure d'audience, utiliser :

```dotenv
NUXT_PUBLIC_SITE_URL=http://localhost:3000
NUXT_PUBLIC_MATOMO_URL=
NUXT_PUBLIC_MATOMO_SITE_ID=
NUXT_BIGBADBOT_BRIDGE_REQUIRED=false
NUXT_OAUTH_DISCORD_REDIRECT_URL=http://localhost:3000/auth/discord
```

Les autres valeurs de `.env.example` sont des exemples à remplacer, pas des
identifiants utilisables. Ne jamais demander ou réutiliser une configuration
de production pour contribuer.

```bash
pnpm dev
```

Le site est disponible sur `http://localhost:3000`. Au premier accès, le CMS
crée `.data/db/wolves.sqlite`, applique les migrations et initialise une base
vide avec le contenu initial du seed. `.data/` est local, persistant et exclu
de Git. Il ne s'agit pas d'une copie de la base du site en ligne.

### Administration locale et Discord

Pour ouvrir `/admin`, créer sa propre application OAuth2 Discord de
développement et enregistrer exactement
`http://localhost:3000/auth/discord` comme URL de redirection. Renseigner dans
`.env` son Client ID, son Client Secret, un mot de passe de session aléatoire
d'au moins 32 caractères et son propre ID utilisateur Discord numérique comme
super administrateur. Un pseudonyme ne doit jamais servir d'autorisation.

La configuration et les rôles sont détaillés dans [CMS.md](CMS.md). Aucun
token de bot Discord n'est nécessaire dans le navigateur ou dans le dépôt.

### Fonctionnalités dépendant de BigBadBot

BigBadBot est un service distinct, privé, non fourni avec ce dépôt. Le site
public et le CMS local peuvent être développés sans lui, mais les parcours
membre, inscriptions, créneaux, statistiques d'équipe et annonces Discord
nécessitent un bridge BigBadBot compatible et autorisé.

Sans ce service, ces parcours ne constituent pas une démonstration complète :
les données membres sont indisponibles et les accès concernés peuvent être
refusés. Ne pas contourner les permissions pour les faire fonctionner. Utiliser
des données fictives dans les tests, jamais une base ou un export nominatif de
production.

L'intégration passe côté serveur par des requêtes HMAC signées. Le bridge doit
rester privé et ne doit jamais être appelé directement par le navigateur. La
projection personnelle SQLite, lorsqu'elle est disponible dans un environnement
de développement autorisé, est agrégée et en lecture seule ; ce n'est jamais la
base brute du bot.

## Docker local

Le fichier `compose.yaml` sert uniquement au développement local. Adapter les
URL du `.env` à `http://localhost:3001`, y compris le callback Discord, puis
enregistrer ce callback dans son application Discord de développement.

```bash
docker compose up -d --build
docker compose ps
docker compose down
```

Le site est disponible sur `http://localhost:3001`. Les valeurs OAuth de secours
du Compose sont fictives et permettent seulement le démarrage du conteneur :
une connexion réelle exige sa propre configuration Discord. Garder Matomo
désactivé et le bridge optionnel en local.

SQLite et les médias restent dans le volume `wolves-cms-data` après
`docker compose down`. Ne pas ajouter `-v` sauf si la suppression irréversible
de toutes les données CMS locales est réellement voulue. Ce Compose n'est pas
une procédure de déploiement du site en ligne.

## Vérifications

Les contributeurs peuvent lancer les contrôles suivants dans leur environnement
de développement :

```bash
pnpm check
pnpm check:all
```

`pnpm check` exécute ESLint, le contrôle Prettier, le typecheck Nuxt et les tests
Vitest. `pnpm check:all` ajoute le build de production Nitro. Les pages CMS
restent dynamiques : une publication doit être visible sans rebuild.

Pour appliquer les corrections automatiques avant de relancer les contrôles :

```bash
pnpm lint:fix
pnpm format
```

Les réglages VS Code recommandent Vue Official, ESLint et Prettier, avec
formatage et corrections ESLint à l'enregistrement. Les règles de développement
figurent dans [AGENTS.md](AGENTS.md).

## Contenus et CMS

La source de vérité au runtime est SQLite :

- `pages`, `revisions` et `blocks` portent les brouillons et publications ;
- `settings` alimente l'identité, la navigation et les réseaux sociaux ;
- `media` et `media_variants` référencent les fichiers WebP ;
- `users` et `audit` portent les accès Discord et les opérations sensibles.

`server/data/cms-seed.ts` initialise uniquement une base vide et s'appuie encore
sur `app/data/site.ts`. Modifier ces fichiers ne met pas à jour une base déjà
initialisée : utiliser l'administration locale ou prévoir une migration
explicite et compatible.

Les blocs et leur validation sont centralisés dans `shared/cms/`. Leur rendu
public se trouve sous `app/components/cms/`. Voir [CMS.md](CMS.md) pour le modèle
éditorial, les images et l'authentification.

## Parcours membres et opérationnels

Les fonctionnalités suivantes font partie du code du site, mais leurs données
et autorisations opérationnelles dépendent du service BigBadBot privé :

- `/mes-participations` : inscriptions et régularité du compte connecté,
  pas un classement entre membres ni une preuve de présence ;
- `/inscriptions` : disponibilités, inscriptions et alertes ponctuelles ;
  une alerte ne réserve jamais de place ;
- `/creneaux` : participants de la dernière annonce publiée, avec filtrage
  d'équipes et droits revérifiés par le bridge ;
- `/admin/statistiques` : agrégats et détails des équipes selon les droits
  du coach ou de l'administrateur ; voir [TEAM_STATISTICS.md](TEAM_STATISTICS.md) ;
- `/admin/annonces` : préparation des annonces d'entraînement ;
- `/admin/evenements` : événements d'animation et plans de groupes versionnés.

Nuxt ne planifie ni ne publie lui-même les messages Discord. Les autorisations
sont revérifiées côté bridge à chaque opération. Les identifiants de participants
exposés au navigateur sont opaques ; les routes privées sont exclues du sitemap
et de Matomo, et leurs API sont `private, no-store`.

## SEO et mesure d'audience

`NUXT_PUBLIC_SITE_URL` alimente les URL canoniques, le sitemap, les cartes
sociales et les données structurées. Utiliser une URL locale pendant le
développement. Le sitemap découle des révisions publiées indexables.

Matomo reste inactif si son URL ou son identifiant de site est vide. Laisser
**les deux valeurs vides en local** pour ne pas envoyer de visites de test à
une instance réelle. Ne pas utiliser l'instance ou l'identifiant du site en
ligne dans un fork.

L'activation d'une mesure d'audience dans un environnement réel nécessite sa
propre configuration et une revue de confidentialité : information des
personnes, minimisation, consentement ou exemption applicable, conservation et
mécanisme d'opposition. Les routes privées ne doivent pas être mesurées.

## Contribuer

Créer un fork, travailler sur une branche et ouvrir une pull request. Les
merges sur `main` sont réservés au propriétaire. Aucun accès au dépôt privé,
aux secrets ou au serveur de production n'est nécessaire pour contribuer.

Lire [CONTRIBUTING.md](CONTRIBUTING.md) avant de proposer une modification.
Les photos, logos et contenus du club ne deviennent pas libres de droits du
seul fait que ce dépôt est public ; aucune nouvelle licence n'est accordée ici.
