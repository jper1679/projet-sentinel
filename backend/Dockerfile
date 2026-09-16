FROM python:3.11-slim

# Métadonnées
LABEL maintainer="Sentinel Team"
LABEL description="Sentinel Backend - FastAPI + Neo4j"

# Répertoire de travail
WORKDIR /app

# Variables d'environnement Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Dépendances système minimales
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copie et installation des dépendances Python
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Copie du code source
COPY app/ ./app/

# Utilisateur non-root pour la sécurité
RUN addgroup --system sentinel && \
    adduser --system --ingroup sentinel sentinel && \
    chown -R sentinel:sentinel /app
USER sentinel

# Port d'écoute
EXPOSE 8000

# Point d'entrée
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
