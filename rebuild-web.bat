@echo off
echo ========================================
echo LearnFlow Frontend Rebuild Script
echo ========================================
echo.

echo Step 1: Installing dependencies for apps/web...
cd /d "%~dp0"
npm install --workspace=apps/web
if errorlevel 1 (
    echo ERROR: npm install failed!
    pause
    exit /b 1
)
echo.

echo Step 2: Stopping Docker containers...
docker compose down
echo.

echo Step 3: Rebuilding web container (this may take a few minutes)...
docker compose build --no-cache web
if errorlevel 1 (
    echo ERROR: Docker build failed!
    pause
    exit /b 1
)
echo.

echo Step 4: Starting all containers...
docker compose up -d
echo.

echo Step 5: Showing web container logs (Press Ctrl+C to exit)...
echo Wait for "Ready" message, then open http://localhost:3000
echo.
docker compose logs -f web
