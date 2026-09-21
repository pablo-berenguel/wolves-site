# Statistiques d’équipes

## Parcours et droits

L’administration propose `/admin/statistiques` et
`/admin/statistiques/penta` (même forme pour `poly`, `hexa`, `hepta`, `octo`
et `octolady`). L’année civile courante en Europe/Paris est choisie par
BigBadBot quand le paramètre `year` est absent. La sélection est conservée
lors du passage à une équipe et du retour à la liste.

| Compte                                        | Agrégats des six équipes | Détail et membres                 |
| --------------------------------------------- | ------------------------ | --------------------------------- |
| Coach d’équipe                                | Oui                      | Seulement ses équipes configurées |
| Head Coach                                    | Oui                      | Toutes les équipes configurées    |
| Administrateur Discord configuré ou CMS actif | Oui                      | Toutes les équipes configurées    |
| Autre membre / visiteur                       | Non                      | Non                               |

Le lien **Statistiques** apparaît dans la navigation d’administration. Un coach
sans accès éditorial peut ouvrir **Administration** depuis le pied de page ;
il est dirigé vers son outil autorisé. Un visiteur est invité à se connecter
avec Discord.

Les API publiques n’acceptent aucun identifiant de membre. L’acteur vient de
la session vérifiée ; l’éventuelle qualité d’admin CMS est relue dans la base
privée à chaque appel. Le bridge HMAC signe aussi cette assertion. BigBadBot
revérifie l’appartenance au serveur et les rôles actuels à chaque lecture,
y compris pour les administrateurs. Un refus ou une panne Discord ne donne
jamais accès aux données. Les réponses privées sont `no-store` ; les membres
ne sont renvoyés que par la route de détail autorisée, sous des clés opaques.
Ces pages privées sont exclues du sitemap et de Matomo.

## Sens des chiffres

- Effectif : membres portant actuellement le rôle d’équipe configuré, hors bots.
  Utiliser exclusivement les rôles **sans « Rentrée »**, conformément au choix
  du club. Aucun rapprochement approximatif par nom n’est effectué.
- Inscriptions : réactions/inscriptions encore actives dans le registre
  BigBadBot, dédupliquées entre Discord et le site. Ce ne sont pas des présences
  confirmées. Un créneau à la fois Open Gym et atelier ne compte qu’une fois
  dans le total, mais dans les deux catégories.
- Annulations : journal conservé, avec un repli partiel pour les anciennes
  réactions annulées. Les annulations tardives sont le sous-ensemble identifié
  à moins de vingt-quatre heures du créneau.
- Année et mois : date de la séance en Europe/Paris, pas date d’ajout de la
  réaction. Les anciens jours sans horaire restent utilisables si le jour est
  connu ; une semaine entièrement contenue dans un mois peut être agrégée à ce
  mois. Les dates restant ambiguës à une frontière de mois/année sont exclues,
  plutôt que de leur inventer une date.
- Équipes historiques : l’effectif est toujours **celui d’aujourd’hui**.
  Sélectionner 2025 ne reconstitue pas les rôles de 2025. Les anciens membres
  ayant quitté l’équipe ne sont donc pas inclus dans ce regroupement.
- Historique absent : des tirets sont affichés, pas une preuve d’absence
  d’activité. Un historique disponible peut malgré tout être incomplet.
- Une personne appartenant à plusieurs équipes apparaît dans chacune ; ne pas
  additionner leurs agrégats pour calculer l’effectif unique du club.

## Contrat d'intégration BigBadBot

BigBadBot est un service privé distinct, non fourni avec ce dépôt public. Ces
parcours nécessitent un bridge compatible et autorisé ; ils ne fonctionnent
pas avec le seul site local. La projection personnelle SQLite v2 n’est pas
modifiée. Les statistiques d’équipe passent directement par le bridge privé,
sans montage de la base brute dans Nuxt et sans nouvelle dépendance.

Dans la configuration privée BigBadBot, renseigner les IDs numériques vérifiés :

- `BIGBADBOT_STATS_TEAM_ROLE_IDS_JSON` : objet clé d’équipe → ID du rôle
  d’athlètes définitif, sans « Rentrée » ;
- `BIGBADBOT_STATS_COACH_ROLE_TEAMS_JSON` : objet ID du rôle de coach → tableau
  de clés d’équipe qu’il encadre ;
- `BIGBADBOT_STATS_ADMIN_ROLE_IDS_JSON` : tableau d’IDs de rôles administrateurs
  Discord, éventuellement vide.

Le rôle Head Coach et le super administrateur réutilisent leur configuration
existante. Ne jamais réutiliser un rôle d’athlètes comme rôle de coach ou
d’administrateur. Les valeurs réelles restent hors de ce dépôt. Sans mapping,
seul l'outil de statistiques d'équipe est indisponible : les
fonctionnalités existantes restent en service. Une configuration partielle
n’accorde aucun détail pour une équipe non configurée.

Les rôles sont résolus par identifiants numériques immuables, jamais par un
rapprochement de noms ou par un nombre de membres. Aucun rôle n’est créé,
déplacé ou remplacé par cet outil. Dans les tests, vérifier les permissions
croisées avec des données entièrement fictives : coach d’une seule équipe,
Head Coach, administrateur et membre ordinaire.

## Reprise d’un ancien historique

Un classement texte ou un total agrégé ne suffit pas à reconstituer un
historique individuel fiable. Toute reprise doit contrôler le format, les IDs
et les dates source, comparer les données dans un environnement autorisé,
préserver une sauvegarde, puis prévoir un import explicitement autorisé et
idempotent. Ne jamais importer
un cumul en plus des mêmes réactions déjà présentes, inventer une date
d’ajout/retrait ou considérer les équipes d’un export comme des rôles historiques
à la date de chaque séance. Les pièces jointes nominatives restent hors Git.

## Vérifications

Site : `pnpm check:all`. Les tests de contrat couvrent notamment la projection
par liste blanche, les clés opaques, les années/mois, l’absence d’usurpation par
query et la revalidation des admins CMS. Les vérifications du service BigBadBot
sont distinctes et ne sont pas exécutables à partir de ce dépôt seul.
