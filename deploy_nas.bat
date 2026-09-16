@echo off
cd /d "%~dp0"

setlocal EnableDelayedExpansion

title Sentinel -- Deploiement NAS

echo.
echo  +--------------------------------------------------+
echo  *         SENTINEL -- Deploiement NAS              *
echo  *         databunker / 192.168.2.114               *
echo  +--------------------------------------------------+
echo.

REM --- Verification : on est bien dans le bon dossier ---
if not exist "docker-compose.yml" (
    echo [ERREUR] docker-compose.yml introuvable dans %cd%.
    echo Assurez-vous d'executer ce script depuis le dossier Sentinel.
    echo.
    pause
    exit /b 1
)

if not exist "nas_config.json" (
    echo [ERREUR] nas_config.json introuvable.
    echo Creez le fichier nas_config.json avec vos identifiants NAS.
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

REM --- Detection de Python (python ou py) ---
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
    echo [ERREUR] Python n'est pas trouve dans le PATH systeme.
    echo Veuillez installer Python depuis https://www.python.org/ et l'ajouter au PATH.
    echo.
    pause
    exit /b 1
)

echo [INFO] Python detecte : %PYTHON_CMD%

REM --- Verification de paramiko ---
%PYTHON_CMD% -c "import paramiko" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Installation de la bibliotheque paramiko...
    %PYTHON_CMD% -m pip install paramiko -q
    if errorlevel 1 (
        echo [ERREUR] Impossible d'installer paramiko.
        echo.
        pause
        exit /b 1
    )
)

REM --- Lancement du deploiement ---
echo [INFO] Lancement du deploiement vers le NAS...
echo.
%PYTHON_CMD% deploy_nas.py

if errorlevel 1 (
    echo.
    echo [ECHEC] Le deploiement a echoue.
    echo.
    pause
    exit /b 1
)

echo.
echo  [OK] Deploiement reussi !
echo  -- Application : http://192.168.2.114:9080
echo  -- Neo4j       : http://192.168.2.114:7474
echo  -- API Docs    : http://192.168.2.114:9080/docs
echo.
pause
