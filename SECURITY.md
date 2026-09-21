# Signaler un problème de sécurité

Ne publiez jamais de secret, de données de membres ou de preuve exploitable
dans une issue ou une pull request publique.

Contactez le mainteneur à `hello.pablo.pro@gmail.com` avec une description
minimale du problème et les étapes de reproduction sans données réelles.
N'envoyez aucun mot de passe, jeton, export de base ou fichier `.env`.

## Séparation des accès

Ce dépôt contient le code du site et une CI de vérification sur des runners
hébergés par GitHub. Il ne contient ni secrets de production, ni workflow de
déploiement, ni accès au runner privé.

Les contributions passent par un fork et une pull request. Toute modification
de dépendances, de scripts d'installation, d'authentification ou de workflows
doit être revue avant fusion et avant exécution d'une contribution externe.

Les valeurs des fichiers `.env.example` sont fictives. N'utilisez jamais les
identifiants ni les bases de production dans un environnement de contribution.
