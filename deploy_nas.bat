@echo off
:: bascule le répertoire courant sur le dossier contenant ce script .bat
cd /d "%~dp0"

setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1

title Sentinel — Déploiement NAS

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║         SENTINEL — Déploiement NAS               ║
echo  ║         databunker / 192.168.2.114               ║
echo  ╚══════════════════════════════════════════════════╝
echo.

:: --- Vérification : on est bien dans le bon dossier ---
if not exist "docker-compose.yml" (
    echo [ERREUR] docker-compose.yml introuvable dans %cd%.
    echo Assurez-vous d'exécuter ce script depuis le dossier Sentinel.
    echo.
    pause
    exit /b 1
)

if not exist "nas_config.json" (
    echo [ERREUR] nas_config.json introuvable.
    echo Créez le fichier nas_config.json avec vos identifiants NAS.
    echo.
    pause
    exit /b 1
)

if not exist ".env" (
    echo [ERREUR] Fichier .env introuvable.
    echo Copiez .env.example en .env et configurez vos variables.
    echo.
    pause
    exit /b 1
)

:: --- Détection de Python (python ou py) ---
set "PYTHON_CMD="
python --version >nul 2>&1
if not errorlevel 1 (
    set "PYTHON_CMD=python"
) else (
    py -0 >nul 2>&1
    if not errorlevel 1 (
        set "PYTHON_CMD=py"
    )
)

if "%PYTHON_CMD%"=="" (
    echo [ERREUR] Python n'est pas trouvé dans le PATH système.
    echo Veuillez installer Python depuis https://www.python.org/ et l'ajouter au PATH.
    echo.
    pause
    exit /b 1
)

echo [INFO] Python détecté : %PYTHON_CMD%

:: --- Vérification de paramiko ---
%PYTHON_CMD% -c "import paramiko" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Installation de la bibliothèque paramiko...
    %PYTHON_CMD% -m pip install paramiko -q
    if errorlevel 1 (
        echo [ERREUR] Impossible d'installer paramiko.
        echo.
        pause
        exit /b 1
    )
)

:: --- Lancement du déploiement ---
echo [INFO] Lancement du déploiement vers le NAS...
echo.
%PYTHON_CMD% deploy_nas.py

if errorlevel 1 (
    echo.
    echo [ÉCHEC] Le déploiement a échoué.
    echo.
    pause
    exit /b 1
)

echo.
echo  ✓ Déploiement réussi !
echo  → Application : http://192.168.2.114:9080
echo  → Neo4j       : http://192.168.2.114:7474
echo  → API Docs    : http://192.168.2.114:9080/docs
echo.
pause
