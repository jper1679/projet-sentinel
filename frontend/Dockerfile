# ==============================================================================
# Projet Sentinel — Frontend Dockerfile (Multi-stage)
# Stage 1 : Build Vite
# Stage 2 : Serve avec Nginx
# ==============================================================================

# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copie les manifestes en premier pour bénéficier du cache Docker
COPY package.json package-lock.json* ./
RUN npm install

# Copie le code source et build
COPY . .
RUN npm run build

# ---- Stage 2: Serve ----
FROM nginx:1.27-alpine AS runner

# Copie le build Vite vers Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Config Nginx pour SPA (React Router fallback)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
