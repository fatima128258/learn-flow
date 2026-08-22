@echo off
echo ========================================
echo LearnFlow Frontend Simple Rebuild
echo ========================================
echo.

cd /d "c:\Users\Rajpoot Qamar Abbas\Desktop\learnflow"

echo Step 1: Stopping containers...
docker compose down
echo.

echo Step 2: Removing old web image...
docker rmi learnflow-web 2>nul
echo.

echo Step 3: Building web with Tailwind v3 (may take 2-3 minutes)...
docker compose build --no-cache web
if errorlevel 1 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)
echo.

echo Step 4: Starting containers...
docker compose up -d
echo.

echo Step 5: Waiting for startup...
timeout /t 5 /nobreak >nul
echo.

echo Step 6: Showing logs (Press Ctrl+C when you see "Ready")...
echo Then open: http://localhost:3000
echo.
docker compose logs -f web
