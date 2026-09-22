# Sentinel — Description du Système (Vue Haut Niveau)

Ce document présente une vue synthétique et de haut niveau des fonctionnalités utilisateur actuellement implémentées dans l'application **Sentinel**.

---

## 1. Vue Carte Mentale (Mindmap Board)
Le cœur de l'application est une interface graphique interactive basée sur un canevas orienté graphe :
- **Création rapide de nœuds** : Par clic sur le canevas ou via le bouton `+ Nœud`.
- **Ouverture directe Fiche Jira** : **Double-clic sur n'importe quel nœud** pour ouvrir immédiatement sa fiche complète style Jira (`/node/:id`).
- **Types de nœuds supportés** : Idée (💡), Tâche (✅), Projet (📁), Composant (⚙️), **Procédure (📋)** et **Étape (🔹)** avec stylisation visuelle propre et icônes dédiées.
- **Création et typage des liaisons (`EXECUTE_AVANT`, `BLOQUÉE_PAR`, `RATTACHÉ_À`, `SUIVIE_DE`, `LIÉ_À`)** : Support de la relation d'ordonnancement *"... doit être exécuté avant ..."* (`EXECUTE_AVANT`) utilisable pour la vue Gantt. Glisser-déposer entre les poignées des nœuds ou via le bouton `+ Lien`.
- **Points de connexion au survol (Hover Handles)** : Les poignées de liaison des blocs sont invisibles par défaut et apparaissent avec une transition fluide uniquement au survol du curseur ou sur sélection du nœud.
- **Sélecteur de champs affichés (Field Visibility Customization)** : Menu déroulant `Champs affichés 👁️` dans la barre d'outils permettant à l'utilisateur de cocher/décocher à la carte les attributs visibles sur le canevas (Type, Statut, Priorité, Temps estimé, Coût estimé, Extrait de description) avec persistance locale dans `localStorage`.
- **Déplacement et persistance** : Positionnement libre des nœuds avec sauvegarde automatique des coordonnées (`pos_x`, `pos_y`).
- **Auto-arrangement** : Réorganisation automatique du canevas via le menu *Auto-Arranger* (dispositions : Mindmap Horizontale, Arbre Vertical, Grille Matrice).
- **Contrôles du canevas** : Zoom avant/arrière, réinitialisation de vue (vue d'ensemble) et rechargement dynamique du graphe.
- **Statistiques & Légende** : Compteurs de nœuds/liens en temps réel et légende visuelle par type de nœud.

---

## 2. Vue Page Dédiée Nœud (Mode Fiche Jira `/node/:id`)
Une vue complète et autonome simulant une fiche de ticket Jira pour chaque nœud du système :
- **Accès universel** : Accessible via double-clic sur le canevas, bouton *Pleine page* du tiroir ou route directe `/node/:id`.
- **Barre d'actions & Fil d'Ariane** : Navigation de retour au canevas, identifiant unique de ticket (`SENT-node_id`), raccourci vers la vue Gantt, boutons de partage d'URL, de suppression et de sauvegarde.
- **Zone principale (2/3)** : Édition du titre en grand format, zone de description détaillée (support Markdown) et gestionnaire complet des dépendances et relations Neo4j avec labels clairs (*Doit être exécuté avant*, *Bloquée par*, *Rattaché à*) et formulaire d'ajout direct de liaisons.
- **Panneau latéral (1/3)** : Panneau complet de métadonnées avec sélecteurs de Type (Idée, Tâche, Projet, Composant), Statut (Backlog, À faire, En cours, Terminé, Bloqué 🔒), Priorité (Basse, Normale, Haute, Critique), Temps estimé (h), Coût ($) et dates de création/modification.

---

## 3. Vue Diagramme de Gantt & Dépendances (`/gantt`)
Une vue chronologique et visuelle d'ordonnancement d'exécution des tâches :
- **Analyse des dépendances** : Calcul automatique des niveaux d'exécution (Phases 1, 2, 3...) basé sur les liaisons `EXECUTE_AVANT`, `SUIVIE_DE` et `BLOQUEE_PAR`.
- **Visualisation par phases** : Barres chronologiques colorées selon le statut Jira (Backlog, À faire, En cours, Terminé, Bloqué 🔒) avec durée estimée (`temps_estime_h`).
- **Filtres interactifs** : Recherche textuelle en temps réel, filtres par type de nœud et par statut.
- **Navigation directe** : Clic direct sur une barre du Gantt pour ouvrir sa fiche complète Jira (`/node/:id`).

---

## 4. Ingestion IA Scratchpad (Daily Scratchpad — Gemini AI Ops)
Module d'analyse automatique des notes brutes quotidiennes et procédures piloté par l'IA Gemini 3.6 Flash :
- **Bouton & Raccourci Clavier** : Bouton `⚡ Scratchpad` dans la barre d'outils et déclencheur global `Ctrl+K`.
- **Saisie Brute (Input Mode)** : Zone de texte libre permettant de coller/saisir les faits marquants, achats, avancements ou procédures complètes.
- **Dialogue Clarifiant Sans Devinette (Clarification Mode)** : Si l'IA détecte qu'aucun projet cible n'est explicitement spécifié ou qu'une ambiguïté existe, l'agent suspend l'ingestion et déclenche un encadré interactif de clarification demandant à l'utilisateur de préciser le projet.
- **Génération de Procédures & Étapes (Graph Generator)** : Extraction automatique de nœuds racines `:PROCEDURE`, d'étapes ordonnées `:ETAPE` et des liaisons Neo4j (`:CONTIENT_ÉTAPE`, `:SUIVIE_DE`, `:RATTACHÉ_À`).
- **Mode Révision Interactif (Review Mode)** : Visualisateur de pipeline d'étapes avec cartes d'actions avant commit dans Neo4j.

---

## 5. Tiroir d'Enrichissement (Node Detail Drawer)
Lorsqu'un nœud est simplement sélectionné sur le canevas :
- **Édition rapide** : Modification du titre, de la description, du type, de la priorité et du statut.
- **Accès rapide page Jira** : Bouton `Pleine page ↗` pour ouvrir la fiche complète `/node/:id`.
- **Suppression** : Option de suppression définitive du nœud et de ses liaisons associées.

---

## 6. Vue Liste (Task List View)
Une vue alternative permettant de consulter et filtrer les nœuds sous forme de tableau.

---

## 7. Authentification & Sécurité
- **Connexion utilisateur** : Écran de login sécurisé par jetons JWT.
- **Gestion des rôles (RBAC)** : Différenciation des droits (Admin, Éditeur, Lecteur).
- **Gestion de session** : Déconnexion rapide et persistance de l'état utilisateur via Zustand.

---

## 8. Persistance des Données & Migration Zéro Perte
- **Garantie de persistance lors des déploiements** : Conservation stricte des volumes Docker Neo4j (`neo4j_data`) lors des mises à jour NAS sans aucune purge.
- **Sauvegarde pré-déploiement automatisée** : Export automatique d'instantanés Cypher/JSON avant toute opération d'arrêt de conteneurs dans `deploy_nas.py`.
- **Migrations idempotentes au démarrage** : Module `migration.py` qui applique les contraintes, index et valeurs par défaut aux nœuds et relations existants sans altérer les données saisies.

---

## 9. Agent Autonome de Maintenance GitHub & Bot Discord
- **Intégration Outils GitHub (`PyGithub`)** : Lecture et recherche dans le dépôt, proposition de PR.
- **Règles de Sécurité** : Création systématique de branche dédiée et ouverture de Pull Request.
- **Passerelle Bot Discord (`@SentinelBot` / Brad)** : Écouteur Discord avec limitation de débit à 5 RPM.
- **Traçabilité Neo4j** : Nœuds `:AgentAction` et `:PullRequest` enregistrés dans le graphe.

---

## 10. Infrastructure & Backend
- **Base de données Graphe** : Neo4j 5.21 Community.
- **API REST FastAPI & Agents IA** : Services web Python 3.11 avec Swagger/OpenAPI (`/docs`).
- **Déploiement Docker & Nginx** : Architecture conteneurisée sur NAS XPEnology.
