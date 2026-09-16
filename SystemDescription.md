# Sentinel — Description du Système (Vue Haut Niveau)

Ce document présente une vue synthétique et de haut niveau des fonctionnalités utilisateur actuellement implémentées dans l'application **Sentinel**.

---

## 1. Vue Carte Mentale (Mindmap Board)
Le cœur de l'application est une interface graphique interactive basée sur un canevas orienté graphe :
- **Création rapide de nœuds** : Par double-clic sur le canevas ou via le bouton `+ Nœud`.
- **Types de nœuds supportés** : Idée, Tâche, Projet, Composant, **Procédure (📋)** et **Étape (🔹)** avec stylisation visuelle propre et icônes dédiées.
- **Création de liaisons (`LIÉ_À`, `CONTIENT_ÉTAPE`, `SUIVIE_DE`, `RATTACHÉ_À`)** : Glisser-déposer entre les poignées des nœuds ou via le bouton `+ Lien`.
- **Déplacement et persistance** : Positionnement libre des nœuds avec sauvegarde automatique des coordonnées (`pos_x`, `pos_y`).
- **Auto-arrangement** : Réorganisation automatique du canevas via le menu *Auto-Arranger* (dispositions : Mindmap Horizontale, Arbre Vertical, Grille Matrice).
- **Contrôles du canevas** : Zoom avant/arrière, réinitialisation de vue (vue d'ensemble) et rechargement dynamique du graphe.
- **Statistiques & Légende** : Compteurs de nœuds/liens en temps réel et légende visuelle par type de nœud.

---

## 2. Ingestion IA Scratchpad (Daily Scratchpad — Gemini AI Ops)
Module d'analyse automatique des notes brutes quotidiennes et procédures piloté par l'IA Gemini 3.6 Flash :
- **Bouton & Raccourci Clavier** : Bouton `⚡ Scratchpad` dans la barre d'outils et déclencheur global `Ctrl+K`.
- **Saisie Brute (Input Mode)** : Zone de texte libre permettant de coller/saisir les faits marquants, achats, avancements ou procédures complètes.
- **Dialogue Clarifiant Sans Devinette (Clarification Mode)** : Si l'IA détecte qu'aucun projet cible n'est explicitement spécifié ou qu'une ambiguïté existe, l'agent suspend l'ingestion et déclenche un encadré interactif de clarification demandant à l'utilisateur de préciser le projet (avec sélection rapide parmi les projets Neo4j existants).
- **Génération de Procédures & Étapes (Graph Generator)** : Extraction automatique de nœuds racines `:PROCEDURE`, d'étapes ordonnées `:ETAPE` et des liaisons Neo4j (`:CONTIENT_ÉTAPE`, `:SUIVIE_DE`, `:RATTACHÉ_À`).
- **Mode Révision Interactif (Review Mode)** : Visualisateur de pipeline d'étapes avec flèches directionnelles et cartes d'actions catégorisées (Tâche, Achat, Blocage, Avancement) avant commit dans Neo4j.
- **Persistance Graphe Cypher** : Création et mise à jour automatique des nœuds et des relations dans Neo4j lors de la validation.


---

## 3. Tiroir d'Enrichissement (Node Detail Drawer)
Lorsqu'un nœud est sélectionné sur le canevas :
- **Édition des métadonnées** : Modification du titre, de la description, du type, de la priorité et du statut.
- **Gestion des étiquettes (Tags)** : Ajout et suppression de tags thématiques.
- **Suppression** : Option de suppression définitive du nœud et de ses liaisons associées.

---

## 4. Vue Liste (Task List View)
Une vue alternative permettant de consulter et filtrer les nœuds et tâches sous forme de liste structurée.

---

## 5. Authentification & Sécurité
- **Connexion utilisateur** : Écran de login sécurisé par jetons JWT.
- **Gestion des rôles (RBAC)** : Différenciation des droits (Admin, Éditeur, Lecteur).
- **Gestion de session** : Déconnexion rapide et persistance de l'état utilisateur via Zustand.

---

## 6. Agent Autonome de Maintenance GitHub & Bot Discord
Agent autonome de maintenance du dépôt et de documentation automatisée :
- **Intégration Outils GitHub (`PyGithub`)** : Outils de lecture de fichiers (`read_repo_file`), recherche dans le code (`search_repo`) et proposition de mise à jour documentaire (`propose_doc_update`).
- **Règles de Sécurité** : Interdiction stricte de pousser directement sur la branche principale (`main`/`master`) ; l'agent crée systématiquement une branche dédiée et ouvre une Pull Request.
- **Boucle de Tool-Calling Gemini** : Analyse contextuelle multi-tours avec l'IA Gemini (ex. `gemini-2.5-flash`), capable de consulter le dépôt et de rédiger des PRs claires avec justification.
- **Passerelle Bot Discord (`@SentinelBot` / Brad)** : Écouteur sur canaux dédiés ou mentions Discord transmettant les demandes de la communauté/équipe directement à l'agent IA et répondant avec le lien de la PR créée.
- **Limitation de Débit (Rate Limiting Agent Brad)** : Limitation automatique à 5 requêtes par minute (`DISCORD_RATE_LIMIT_RPM=5`) avec mise en attente fluide et notification visuelle dans Discord pour éviter la saturation de l'API Gemini.
- **Traçabilité Graphe Neo4j** : Enregistrement de chaque action sous forme de nœud `:AgentAction` lié aux nœuds `:PullRequest` et aux projets (`(:Project)-[:HAS_AUTOMATION]->(:AgentAction)-[:CREATED_PR]->(:PullRequest)`).

---

## 7. Infrastructure & Backend
- **Base de données Graphe** : Neo4j pour le stockage natif des nœuds, des relations et de l'historique d'automatisation.
- **API REST FastAPI & Agents IA** : Services web avec endpoints `/api/agent/parse`, `/api/agent/apply`, `/api/v1/agent/run-task` et `/api/v1/agent/history`, documentés via Swagger/OpenAPI (`/docs`).
- **Déploiement Docker & Nginx** : Architecture conteneurisée (Nginx, FastAPI, Neo4j, React, Discord Worker).

