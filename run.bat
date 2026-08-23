@echo off
echo Starting LearnFlow Application...
echo.

REM Check if Docker is running
docker version >nul 2>&1
if %errorlevel% neq 0 (
    echo Docker is not running. Starting Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo Please wait for Docker Desktop to start, then run this script again.
    pause
    exit /b 1
)

echo Docker is running. Starting application...
docker-compose up -d

echo.
echo ✅ LearnFlow is starting up!
echo.
echo 🌐 Web App: http://localhost:3000
echo 🔧 API: http://localhost:4000
echo 📧 Email Testing: http://localhost:8025
echo.
echo Press any key to view logs...
pause >nul
docker-compose logs -f