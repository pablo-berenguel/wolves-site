# CMS Wolves Toulouse

Le CMS est intégré au serveur Nuxt. Il ne dépend pas d'un service tiers pour
les contenus : SQLite stocke les données structurées et le système de fichiers
stocke les variantes d'images. L'interface d'administration est disponible
sous `/admin` et l'authentification passe par Discord OAuth2.

## Fonctionnement

```text
/admin ──► brouillon SQLite ──► publication explicite
                                      │
route publique ── SSR Nitro ◄─────────┘
                                      │
                         blocs Vue + médias WebP
```

- Une sauvegarde crée une nouvelle révision de brouillon.
- Une publication pointe la page vers la révision choisie.
- Le site public ne lit que les révisions publiées et les blocs activés.
- Une modification publiée est visible sans rebuild ni redéploiement.
- Le sitemap est dérivé des pages publiées qui ne sont pas en `noindex`.
- Les mutations sensibles et changements d'accès sont inscrits dans le journal
  d'audit.

## Stockage et initialisation

| Contexte           | Base SQLite              | Médias         |
| ------------------ | ------------------------ | -------------- |
| Développement Nuxt | `.data/db/wolves.sqlite` | `.data/media/` |
| Docker             | `/data/db/wolves.sqlite` | `/data/media/` |

SQLite utilise le mode WAL. La base, ses éventuels fichiers `-wal`/`-shm` et
les médias forment un même ensemble opérationnel. En Docker, `/data` doit
toujours être monté sur un volume persistant alors que le reste du conteneur
reste en lecture seule.

Au premier accès à une base vide, les migrations sont appliquées puis
`server/data/cms-seed.ts` importe le contenu actuel du site. Le seed ne se
réapplique pas sur une base déjà initialisée. Une correction de contenu en
production se fait donc dans `/admin` ; une évolution de structure nécessite
une migration versionnée.

Ne jamais committer `.data/`, copier une base de production dans Git ni lancer
`docker compose down -v` sur un environnement contenant des données utiles.
Les sauvegardes et les procédures de production ne sont pas distribuées dans
ce dépôt public. Pour un environnement local, conserver ensemble la base et
les médias et vérifier une restauration avant toute migration destructive.

## Modèle éditorial

Une page possède un chemin fixe, un titre interne, des champs SEO et une liste
ordonnée de blocs. Chaque bloc dispose notamment d'un identifiant stable, d'un
type, d'une variante visuelle, d'un ordre, d'un thème, d'un éventuel ancrage et
d'un état activé/désactivé.

Les types disponibles sont :

- `hero` : titre principal, image/vidéo et actions ;
- `value_ticker` : bandeau animé de valeurs ;
- `split_content` : texte et image en deux colonnes ;
- `team_grid` : cartes d'équipes ;
- `photo_rail` : galerie horizontale ;
- `feature_card` : actualité ou contenu éditorial mis en avant ;
- `link_card_grid` : cartes de navigation illustrées ;
- `social_follow` : liens vers les réseaux sociaux ;
- `cta_band` : appel à l'action ;
- `indexed_card_grid` : cartes ordonnées avec index ;
- `season_card` : informations de saison ou d'inscription ;
- `comparison_card_grid` : comparaison de parcours ou disciplines ;
- `faq` : questions/réponses ;
- `palmares_timeline` : palmarès chronologique ;
- `staff_directory` : bureau, direction sportive et coaching ;
- `contact_directory` : coordonnées et canaux de contact ;
- `rich_text` : contenu éditorial ou légal structuré.

Le registre dans `shared/cms/registry.ts` définit les champs, variantes,
limites et presets d'image. `shared/cms/sanitize.ts` valide les données à la
frontière serveur. Les composants de `app/components/cms/blocks/` assurent le
rendu public. Une page valide doit conserver un seul titre principal : un bloc
`hero` actif ou un bloc `rich_text` actif avec la variante `legal`, pas
plusieurs. Les blocs `rich_text/default` restent disponibles comme sections
secondaires.

### Ajouter ou faire évoluer un bloc

1. Étendre les types de `shared/cms/types.ts`.
2. Déclarer son schéma et ses variantes dans `shared/cms/registry.ts`.
3. Ajouter ou adapter le composant sous `app/components/cms/blocks/` et son
   routage dans `CmsBlockRenderer.vue`.
4. Mettre à jour le seed si une base neuve doit contenir ce bloc.
5. Ajouter les tests de validation et de rendu nécessaires, puis lancer
   `pnpm check:all`.

Ne pas modifier un schéma d'une façon qui rend les révisions existantes
illisibles sans prévoir une migration compatible.

## Images

L'interface accepte une image JPEG, PNG ou WebP non animée, limitée à 10 Mio et
25 mégapixels. Le fichier est décodé, réorienté, débarrassé de ses métadonnées
et converti en variantes WebP :

- `master` : largeur maximale de 2560 px ;
- `hero` : cadre maximal de 1920 × 1080 ;
- `card` : cadre maximal de 960 × 720 ;
- `square` : cadre maximal de 800 × 800 ;
- `thumbnail` : cadre maximal de 480 × 320.

Les fichiers sont adressés par empreinte et ne sont pas remplacés en place. Une
révision publiée continue ainsi de viser sa variante exacte. Le texte alternatif
reste obligatoire pour toute image porteuse de sens ; il peut être vide pour
une image réellement décorative lorsque le schéma l'autorise.

Les médias font partie de la sauvegarde CMS. Copier uniquement le fichier
SQLite produirait une restauration incomplète.

## Authentification Discord

### Créer l'application

Dans le portail développeur Discord :

1. créer une application OAuth2 ;
2. enregistrer exactement l'URL de redirection locale ou publique, par exemple
   `http://localhost:3000/auth/discord` ;
3. conserver uniquement le scope `identify` ;
4. garder le Client Secret hors de Git, des logs et des captures d'écran.

Renseigner ensuite un fichier `.env` non versionné à partir de `.env.example` :

```dotenv
NUXT_SESSION_PASSWORD=une-valeur-aleatoire-d-au-moins-32-caracteres
NUXT_OAUTH_DISCORD_CLIENT_ID=identifiant-de-l-application
NUXT_OAUTH_DISCORD_CLIENT_SECRET=secret-de-l-application
NUXT_OAUTH_DISCORD_REDIRECT_URL=http://localhost:3000/auth/discord
NUXT_CMS_SUPER_ADMIN_DISCORD_ID=identifiant-utilisateur-discord-numerique
```

L'URL de redirection doit correspondre exactement à celle déclarée chez
Discord. Utiliser sa propre application de développement et l'URL locale ;
les identifiants du site en ligne ne sont pas nécessaires pour contribuer.

### Trouver l'ID du super administrateur

Dans Discord, activer le mode développeur, ouvrir le menu du compte concerné et
choisir « Copier l'identifiant utilisateur ». La valeur attendue est un nombre
de 17 à 20 chiffres. Un pseudonyme, le nom affiché ou une adresse
e-mail ne sont pas des identifiants d'autorisation valides.

Au premier login, l'ID privé configuré par
`NUXT_CMS_SUPER_ADMIN_DISCORD_ID` peut créer automatiquement le compte super
administrateur. Un utilisateur sans rôle CMS peut aussi ouvrir uniquement son
espace `/mes-participations` lorsque son ID existe dans la projection agrégée de
BigBadBot. Un membre sans historique peut également se connecter lorsque
BigBadBot confirme en temps réel qu'il a accès au salon des annonces. Il
n'obtient alors aucun accès à `/admin`.

### Rôles

Les parcours liés à BigBadBot supposent un service privé compatible, non fourni
avec ce dépôt. Sans bridge autorisé, le CMS local reste utilisable avec son
super administrateur configuré, mais les parcours membres et opérationnels
peuvent être indisponibles. Ne jamais désactiver leurs contrôles d'accès pour
simuler une intégration.

| Rôle                 | Capacités                                                                           |
| -------------------- | ----------------------------------------------------------------------------------- |
| Éditeur              | Lire et enregistrer les brouillons, téléverser des images                           |
| Administrateur       | Capacités éditeur, publier les pages, modifier les réglages communs                 |
| Super administrateur | Capacités administrateur, créer, désactiver et attribuer les rôles des utilisateurs |
| Head Coach Discord   | Gérer les annonces d’entraînement et les événements si le rôle Discord est actif    |

Le rôle `super_admin` stocké seul en base ne suffit pas : l'ID doit également
correspondre à la valeur privée de l'environnement. Les sessions expirent au
bout de huit heures et l'autorisation est relue dans SQLite à chaque requête
protégée ; désactiver un compte coupe donc ses accès sans attendre la fin de sa
session.

Head Coach n'est pas un rôle CMS. BigBadBot compare l'identifiant Discord du
compte connecté à l'identifiant numérique immuable du rôle configuré, à chaque
lecture et mutation. Un Head Coach sans compte CMS ne voit que la rubrique
`/admin/annonces` et `/admin/evenements` ; il ne peut ni éditer les pages, ni
les réglages, ni les utilisateurs.

La route membre n'accepte jamais d'identifiant dans la requête : le serveur
utilise exclusivement celui de la session OAuth. La projection BigBadBot est
montée en lecture seule et reste séparée de la base CMS et de la base brute du
bot.

La page `/inscriptions` utilise un bridge HTTP disponible uniquement sur un
réseau Docker privé. Nuxt signe les requêtes avec une clé HMAC fournie par un
secret Docker, puis BigBadBot revérifie les permissions Discord, la capacité et
l'état du créneau avant toute mutation. Le navigateur ne reçoit ni identifiant
Discord, ni identifiant de message brut, ni secret du bridge. Les identifiants
de créneau exposés sont opaques et ne suffisent jamais à autoriser une action.
La clé partagée est un secret texte imprimable d'au moins 32 caractères, généré
par exemple avec `openssl rand -hex 48`, et non un fichier binaire aléatoire.

## Utilisation de l'administration

1. Se connecter depuis `/admin/login` avec Discord.
2. Choisir une page dans `/admin`.
3. Modifier les champs SEO et les blocs, leur ordre ou leur état.
4. Enregistrer le brouillon et noter la modification si utile.
5. Vérifier le résultat, puis demander à un administrateur de publier la
   révision courante.

Les réglages globaux se trouvent dans `/admin/settings` et les comptes dans
`/admin/users`. Un conflit signale qu'une autre session a enregistré une
révision entre-temps : recharger la page avant de reprendre les changements au
lieu d'écraser la version concurrente.

Les annonces d'entraînement se trouvent dans `/admin/annonces`. Le formulaire
préremplit la prochaine semaine et une diffusion le dimanche de 17 h à 19 h.
Il accepte plusieurs créneaux par jour, dans la limite de vingt réactions
Discord par message. BigBadBot conserve les brouillons, révisions, horaires et
publications dans sa propre base SQLite. L'historique démarre avec les annonces
créées par cet outil ; les anciens messages Discord ne sont pas importés.

Les événements d’animation se trouvent dans `/admin/evenements`. BigBadBot
importe un nombre borné de messages récents du salon et de l’auteur configurés
par leurs IDs Discord immuables. Ces messages historiques restent en lecture
seule. Un nouveau message peut contenir plusieurs événements et chaque
événement plusieurs catégories de réaction. L’aperçu affiché provient du même
renderer que la publication Discord.

La vue « Participants & groupes » sépare chaque emoji : une inscription `🔥`
et une disponibilité bénévole `✌️` ne sont jamais fusionnées. Les plans sont
sauvegardés par catégorie avec verrou de version et groupes de trois. Une
personne déjà affectée qui retire sa réaction reste visible dans son groupe avec
le statut retiré, afin qu’un changement Discord ne modifie pas silencieusement
le plan du coach.

Le suivi historique exact commence à l’activation du bot. L’API Discord ne
donne pas la date d’ajout des réactions déjà présentes lors du premier import ;
l’interface l’indique et ne fabrique jamais de timestamp. Ces listes sont des
données personnelles privées : elles ne doivent pas être exportées dans le CMS
public, les logs ou la projection de statistiques agrégée.

## Exploitation

- `/healthz` vérifie la base, le répertoire média inscriptible et, en
  production, la présence d'une configuration privée cohérente.
- Les routes publiques sont SSR et dynamiques ; ne pas réintroduire de
  prerender des pages CMS.
- Le serveur a besoin d'un accès HTTPS sortant pour l'échange OAuth Discord.
- SQLite convient au déploiement mono-instance actuel. Ne pas démarrer plusieurs
  conteneurs web concurrents sur le même volume sans revoir l'architecture.
- Avant une migration, un déploiement ou une restauration, sauvegarder ensemble
  toute la racine `/data` et vérifier l'archive.
