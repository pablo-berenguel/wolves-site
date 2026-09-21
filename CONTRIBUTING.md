# Contribuer au site Wolves Toulouse

Les contributions passent par un fork et une pull request. Aucun droit
d'écriture sur le dépôt d'origine et aucun accès aux secrets ou aux serveurs
de production ne sont nécessaires.

## Proposer une modification

1. Lire [README.md](README.md) et les règles de [AGENTS.md](AGENTS.md).
2. Créer un fork, puis une branche ciblée à partir de `main`.
3. Utiliser sa propre configuration de développement et uniquement des données
   fictives. Garder Matomo désactivé en local.
4. Faire une modification limitée, accessible, responsive et compatible SSR.
5. Exécuter les contrôles proportionnés au changement dans son environnement,
   puis décrire les résultats réels dans la pull request.
6. Ouvrir une pull request vers `main`, avec le besoin, la solution, les
   limites connues et des captures sans donnée privée si l'interface change.

Seul le propriétaire est autorisé à merger dans `main`. Une proposition ne
déploie rien en production. Le déploiement et ses secrets sont gérés dans un
dépôt privé distinct ; le transfert automatique des versions n'est pas encore
raccordé.

## Contrôles recommandés

```bash
pnpm check
pnpm check:all
```

Le premier contrôle regroupe lint, formatage, types et tests ; le second ajoute
le build Nitro. Indiquer les contrôles non exécutés et leur raison plutôt que
de les présenter comme réussis. Pour l'interface, vérifier le clavier, les
contrastes, le mobile et le bureau.

Les tests GitHub du dépôt public, lorsqu'ils sont exécutés, utilisent des
runners hébergés par GitHub et ne doivent recevoir aucun secret de production.
Une pull request externe peut nécessiter l'approbation du propriétaire avant
l'exécution de ses workflows.

## Sécurité et données

- Ne jamais ajouter `.env`, clés privées, mots de passe, jetons, cookies,
  sauvegardes, exports de participants, bases SQLite ou journaux nominatifs.
- Ne pas publier de configuration opérationnelle, d'adresse interne, de chemin
  de serveur ou d'identifiant Discord privé dans les fichiers, captures,
  issues ou commentaires.
- Utiliser sa propre application OAuth Discord de développement. BigBadBot
  est un service privé optionnel ; son absence n'autorise pas à contourner les
  contrôles d'accès ou à demander les données du club.
- Ne pas ajouter de runner auto-hébergé, d'accès au serveur ou de workflow de
  déploiement à ce dépôt public.
- Si un secret a été publié accidentellement, prévenir immédiatement le
  propriétaire par un canal privé sans recopier sa valeur. Le retirer d'un
  fichier ne suffit pas : il doit être révoqué ou renouvelé.
- Pour une vulnérabilité sensible, suivre [SECURITY.md](SECURITY.md) avant de
  publier des détails exploitables dans une issue.

## Contenus et droits

Ne pas inventer de résultats sportifs, de coordonnées ou d'informations sur
le club. Toute évolution des photos, logos, textes ou données personnelles
doit respecter les droits des personnes concernées. La visibilité publique de
ce dépôt ne vaut pas attribution d'une licence sur ces contenus.
