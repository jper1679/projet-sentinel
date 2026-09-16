# Sentinel — PLM/ALM par Graphe (Jalon 1)

> Application conteneurisée d'organisation et de gestion de projet par graphe, hébergée sur NAS XPEnology / Synology Docker.

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%203.11-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![Neo4j](https://img.shields.io/badge/DB-Neo4j%205.x-00B4E6?logo=neo4j)](https://neo4j.com)
[![React](https://img.shields.io/badge/Frontend-React%2018-61DAFB?logo=react)](https://react.dev)
[![Docker](https://img.shields.io/badge/Infra-Docker%20Compose-2496ED?logo=docker)](https://docs.docker.com/compose/)

---

## Architecture

```
                ┌─────────────────────────────┐
                │   Navigateur :9080           │
                └─────────────┬───────────────┘
                              │
                ┌─────────────▼───────────────┐
                │     Nginx (Reverse Proxy)    │
                │  /api/* → backend:8000       │
                │  /      → frontend:80        │
                └──────┬──────────┬───────────┘
                       │          │
          ┌────────────▼──┐   ┌───▼──────────────┐
          │  Backend       │   │  Frontend          │
          │  FastAPI 3.11  │   │  React 18 + Vite   │
          │  JWT / RBAC    │   │  React Flow        │
          │  Neo4j Driver  │   │  Zustand / Axios   │
          └────────────┬──┘   └───────────────────-┘
                       │
          ┌────────────▼──────────────┐
          │  Neo4j 5.x Community      │
          │  Bolt :7687               │
          │  Browser :7474            │
          └───────────────────────────┘
```

---

## Prérequis

- **Docker Engine** ≥ 24.x (ou Docker Desktop)
- **Docker Compose** v2 (`docker compose` — sans tiret)
- Ports disponibles sur l'hôte : `9080`, `7474`, `7687`

---

## Démarrage Rapide

### 1. Cloner et configurer l'environnement

```bash
git clone <url-du-repo> sentinel
cd sentinel

# Copier et éditer le fichier d'environnement
cp .env.example .env
```

### 2. Éditer le fichier `.env`

Ouvrez `.env` et remplacez **toutes** les valeurs `ChangeMe_*` et `replace_*` :

```dotenv
# Neo4j
NEO4J_PASSWORD=VotreMotDePasseNeo4j!

# JWT (générez avec : python -c "import secrets; print(secrets.token_hex(64))")
JWT_SECRET_KEY=votre_cle_tres_longue_et_aleatoire

# Compte ADMIN initial
ADMIN_EMAIL=admin@votre-domaine.com
ADMIN_PASSWORD=VotreMotDePasseAdmin!

# Brevo SMTP (optionnel pour le Jalon 1)
BREVO_API_KEY=xkeysib-...
```

### 3. Construire et démarrer les conteneurs

```bash
docker compose up -d --build
```

Le démarrage complet prend ~60-90 secondes (Neo4j est le plus lent).

### 4. Vérifier que tout est en marche

```bash
docker compose ps
```

Vous devriez voir 4 services avec le statut **running** :

| Service            | Port hôte | Description         |
|--------------------|-----------|---------------------|
| sentinel_neo4j     | 7474, 7687| Base de données     |
| sentinel_backend   | (interne) | API FastAPI         |
| sentinel_frontend  | (interne) | Build React         |
| sentinel_nginx     | **9080**  | Point d'entrée      |

### 5. Accéder à l'application

| URL                                  | Description             |
|--------------------------------------|-------------------------|
| `http://<NAS_IP>:9080`               | 🌐 Application Sentinel |
| `http://<NAS_IP>:9080/docs`          | 📚 Swagger FastAPI      |
| `http://<NAS_IP>:7474`               | 🗄️ Neo4j Browser         |

---

## Utilisation de l'IHM Mindmap

| Action                              | Résultat                                  |
|-------------------------------------|-------------------------------------------|
| **Double-clic** sur le fond         | Crée un nœud « Nouvelle idée »            |
| **Clic** sur un nœud               | Ouvre le tiroir d'enrichissement          |
| **Glisser** entre deux handles      | Crée une relation `LIÉ_À`                |
| **Supprimer** une arête sélectionnée | Touche `Del` ou `Backspace`              |
| **Déplacer** un nœud               | Position persistée automatiquement       |

---

## Vérification de l'API

```bash
# Health check
curl http://localhost:9080/api/health

# Login → obtenir un token JWT
TOKEN=$(curl -s -X POST http://localhost:9080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@sentinel.local","password":"VotreMotDePasse"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Lister les nœuds
curl -H "Authorization: Bearer $TOKEN" http://localhost:9080/api/nodes/

# Créer un nœud
curl -X POST http://localhost:9080/api/nodes/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"titre":"Mon premier projet","type":"PROJET","pos_x":100,"pos_y":100}'
```

---

## Commandes de Maintenance

```bash
# Voir les logs en temps réel
docker compose logs -f

# Logs d'un seul service
docker compose logs -f backend

# Redémarrer un service
docker compose restart backend

# Arrêter proprement
docker compose down

# Arrêter ET supprimer les volumes (⚠️ perte de données Neo4j !)
docker compose down -v

# Rebuild après modification du code
docker compose up -d --build backend
docker compose up -d --build frontend
```

---

## Développement Local (sans Docker)

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt

# Copier le .env à la racine de backend/
cp ../.env .env

# Neo4j doit être accessible sur bolt://localhost:7687
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # Démarre sur http://localhost:5173
                   # avec proxy /api → http://localhost:8000
```

---

## Structure du Projet

```
sentinel/
├── docker-compose.yml        # Orchestration 4 services
├── .env.example              # Template variables d'environnement
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py           # FastAPI + lifespan
│       ├── config.py         # Pydantic Settings
│       ├── auth/             # JWT, Bcrypt, RBAC dependencies
│       ├── database/         # Driver Neo4j, contraintes, sessions
│       ├── models/           # Pydantic schemas (User, Item, Link)
│       ├── routers/          # Endpoints REST (auth, nodes, links, mailer)
│       ├── services/         # Brevo SMTP, Cypher engine
│       └── agents/           # Squelette LangGraph (Jalon 2)
├── frontend/
│   ├── Dockerfile            # Multi-stage Vite → Nginx
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── src/
│       ├── App.tsx           # Routing React Router v6
│       ├── store/            # Zustand (auth + graph state)
│       ├── services/         # Axios + nodeService + linkService
│       ├── components/       # CustomMindmapNode, NodeDetailDrawer, Toolbar
│       └── views/            # MindmapBoard, LoginView, TaskListView
└── nginx/
    └── default.conf          # Reverse proxy config
```

---

## Roadmap

| Jalon | Description                            | Statut       |
|-------|----------------------------------------|--------------|
| **1** | MVP Fondations + Mindmap décharge      | ✅ **Livré** |
| 2     | Vue Liste/Kanban + Filtres avancés     | 🔜 Planifié  |
| 3     | Agents IA LangGraph (OpsAgent/Dev)     | 🔜 Planifié  |
| 4     | Collaboration temps réel (WebSockets)  | 🔜 Planifié  |
| 5     | Rapports PLM + Export (PDF/CSV)        | 🔜 Planifié  |

---

## Licence

Projet privé — Tous droits réservés.
