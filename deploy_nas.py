# deploy_nas.py — Projet Sentinel
# Déploie le projet sur le NAS XPEnology via SMB (miroir fichiers) + SSH (docker compose)
#
# Usage : python deploy_nas.py
# Config : nas_config.json (même répertoire)

import os
import sys
import json
import subprocess
import shutil
import base64
import paramiko

CONFIG_FILE = "nas_config.json"

if not os.path.exists(CONFIG_FILE):
    print(f"Erreur : fichier de configuration '{CONFIG_FILE}' introuvable.")
    print("Vérifiez que nas_config.json existe dans le répertoire du projet.")
    sys.exit(1)

try:
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        config = json.load(f)
except Exception as e:
    print(f"Erreur lecture nas_config.json : {e}")
    sys.exit(1)

nas_ip        = config.get("nas_ip")
nas_user      = config.get("nas_user")
nas_password  = config.get("nas_password")
nas_share     = config.get("nas_share_dir")   # chemin UNC Windows \\NAS\docker\sentinel
nas_project   = config.get("nas_project_dir") # chemin Linux  /volume1/docker/sentinel

if not all([nas_ip, nas_user, nas_password, nas_share, nas_project]):
    print("Erreur : nas_config.json est incomplet (champs manquants).")
    sys.exit(1)

# =============================================================================
# 0. Git commit & push local
# =============================================================================
print("=" * 60)
print("0. Vérification du dépôt Git local...")
print("=" * 60)
try:
    status = subprocess.check_output(["git", "status", "--porcelain"], text=True).strip()
    if status:
        print(" -> Modifications détectées, commit automatique...")
        subprocess.check_call(["git", "add", "."])
        subprocess.check_call(["git", "commit", "-m", "auto: deploy sentinel to NAS"])
        print(" -> Commit effectué.")
    else:
        print(" -> Aucune modification locale à commiter.")

    try:
        subprocess.check_call(["git", "push"])
        print(" -> Git push réussi.")
    except Exception as push_err:
        print(f" -> Git push avertissement : {push_err} (le déploiement continue)")
except Exception as git_err:
    print(f" -> Git ignoré : {git_err}")

# =============================================================================
# 1. Miroir des fichiers vers le partage NAS (SMB)
#    Structure Sentinel :
#      sentinel/                  → \\databunker\docker\sentinel\
#        docker-compose.yml       → racine NAS
#        .env                     → racine NAS
#        backend/                 → sous-dossier
#        frontend/                → sous-dossier
#        nginx/                   → sous-dossier
# =============================================================================
print()
print("=" * 60)
print(f"1. Miroir vers le partage NAS : {nas_share}")
print("=" * 60)

EXCLUDED_EXTENSIONS = (".pyc", ".pyo", ".pyd", ".log", ".tmp", ".db", ".backup",
                       ".lnk", ".DS_Store", ".map")
EXCLUDED_DIRS  = {"__pycache__", ".venv", ".git", ".pytest_cache",
                   "node_modules", "dist", ".next", "build", ".mypy_cache"}
EXCLUDED_FILES = {"nas_config.json"}  # Ne pas copier les credentials sur le NAS

os.makedirs(nas_share, exist_ok=True)

def mirror_file(src: str, dst: str):
    """Copie src → dst si le fichier source est plus récent."""
    try:
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if not os.path.exists(dst) or os.path.getmtime(src) > os.path.getmtime(dst):
            shutil.copy2(src, dst)
            print(f" - Copié : {os.path.relpath(src)}", flush=True)
    except Exception as e:
        print(f"   [Avertissement] Impossible de copier {src} : {e}", flush=True)

def mirror_dir(src_dir: str, dst_dir: str):
    """Miroir récursif d'un dossier avec exclusions."""
    for root, dirs, files in os.walk(src_dir):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        rel = os.path.relpath(root, src_dir)
        dst_root = dst_dir if rel == "." else os.path.join(dst_dir, rel)

        for fname in files:
            if fname in EXCLUDED_FILES:
                continue
            if fname.lower().endswith(EXCLUDED_EXTENSIONS):
                continue
            mirror_file(os.path.join(root, fname), os.path.join(dst_root, fname))

# Fichiers racine
ROOT_FILES = [
    "docker-compose.yml",
    ".env",
    "README.md",
]
for rf in ROOT_FILES:
    if os.path.exists(rf):
        mirror_file(rf, os.path.join(nas_share, rf))
    else:
        print(f" - [Ignoré] {rf} absent localement")

# Dossiers à synchroniser
SYNC_DIRS = ["backend", "frontend", "nginx"]
for d in SYNC_DIRS:
    if os.path.isdir(d):
        print(f" -> Synchronisation de '{d}'...", flush=True)
        mirror_dir(d, os.path.join(nas_share, d))
    else:
        print(f" - [Ignoré] Dossier '{d}' absent localement")

print("Miroir terminé.", flush=True)

# =============================================================================
# 2. SSH sur le NAS → docker compose down / build / up
# =============================================================================
print()
print("=" * 60)
print(f"2. Connexion SSH au NAS {nas_ip}...")
print("=" * 60)

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect(nas_ip, username=nas_user, password=nas_password, timeout=15)
    print("Connexion SSH établie.", flush=True)

    cmd_body = (
        f"export PATH=$PATH:/usr/local/bin:/usr/bin:/bin:/volume1/@appstore/ContainerManager/usr/bin:/volume1/@appstore/Docker/usr/bin\n"
        f"cd {nas_project}\n"
        f"echo '[NAS] Répertoire de travail : $(pwd)'\n"
        # Pull depuis Git si le repo est initialisé sur le NAS
        f"if [ -d .git ]; then\n"
        f"  echo '[NAS] Mise à jour Git...'\n"
        f"  git fetch --all || true\n"
        f"  git reset --hard origin/main || git pull || true\n"
        f"fi\n"
        f"echo '[NAS] Arrêt et suppression forcée des conteneurs Sentinel...'\n"
        f"docker rm -f sentinel_neo4j sentinel_backend sentinel_frontend sentinel_nginx 2>/dev/null || true\n"
        f"docker rm -f $(docker ps -a -q --filter 'name=sentinel') 2>/dev/null || true\n"
        f"docker compose down -v --remove-orphans 2>/dev/null || true\n"
        f"echo '[NAS] Démarrage des conteneurs...'\n"
        f"docker compose up -d --remove-orphans\n"
        f"echo '[NAS] Validation des conteneurs en cours d execution :'\n"
        f"docker compose ps\n"
    )

    cmd_b64  = base64.b64encode(cmd_body.encode("utf-8")).decode("ascii")
    command  = f"echo '{nas_password}' | sudo -S sh -c 'echo {cmd_b64} | base64 -d | sh'"

    print("Exécution du script de déploiement Docker sur le NAS...", flush=True)
    stdin, stdout, stderr = client.exec_command(command)

    while True:
        line = stdout.readline()
        if not line:
            break
        safe = line.strip().encode("ascii", errors="replace").decode("ascii")
        print("[NAS]", safe, flush=True)

    err_output = stderr.read().decode("utf-8", errors="ignore")
    if err_output:
        filtered = "\n".join(
            l for l in err_output.splitlines()
            if "Password:" not in l and "[sudo]" not in l
        )
        if filtered.strip():
            print("[NAS-INFO]", flush=True)
            try:
                print(filtered, flush=True)
            except UnicodeEncodeError:
                print(filtered.encode("ascii", errors="replace").decode("ascii"), flush=True)

    client.close()
    print()
    print("=" * 60)
    print("Déploiement Sentinel terminé avec succès !")
    print(f"Accès : http://{nas_ip}:9080")
    print("=" * 60)

except Exception as e:
    print(f"Erreur SSH / déploiement : {e}", flush=True)
    sys.exit(1)
