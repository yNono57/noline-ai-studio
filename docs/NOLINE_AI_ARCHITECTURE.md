# Architecture IA NØLINE

## Produits

- **NØLINE Nova** est l’IA généraliste et conversationnelle.
- **NØLINE Forge** est l’agent de développement quotidien, rapide, performant et économique.
- **NØLINE Apex** est l’agent d’ingénierie maximal destiné aux missions complexes.
- **NØLINE Muse** est le moteur créatif multi-modèles pour générer et éditer des images et des vidéos. Muse reste distinct des agents de conversation Code.

Un **Router interne** pourra ultérieurement sélectionner ou orchestrer Nova, Forge, Apex et Muse selon la tâche, les capacités requises, le coût et la latence.

## Données et contexte

Le modèle persistant suit la hiérarchie **Project → Conversation → Message**. Un projet appartient à un utilisateur, regroupe ses conversations et porte le contexte durable. Une conversation appartient à un projet et contient une suite chronologique de messages normalisés.

La **Project Intelligence** rassemble progressivement la connaissance exploitable d’un projet : structure, conventions, historique, décisions et contexte pertinent. Forge et Apex partagent cette même Project Intelligence afin de préserver la continuité lorsqu’une mission passe de l’exécution quotidienne à l’ingénierie avancée.

## Chat et Code

Les modes **CHAT** et **CODE** restent explicitement séparés. Chat privilégie l’échange conversationnel général ; Code ajoute les outils et contraintes nécessaires au travail logiciel. Les futures exécutions Code devront avoir lieu dans une **sandbox isolée**, avec permissions minimales, limites de ressources, contrôle réseau et traçabilité des actions.

## Fournisseurs de modèles

La couche IA repose sur des contrats indépendants des fournisseurs : messages normalisés, modèles, capacités, génération et streaming. Chaque provider adapte son API à ces contrats. Cette séparation permettra d’ajouter plusieurs fournisseurs et de router les requêtes sans modifier le domaine produit ni coupler les conversations à une API particulière.
