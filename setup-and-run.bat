@echo off
echo LearnFlow - Complete Setup and Run
echo ===================================
echo.

REM Navigate to project directory
cd /d "%~dp0"

REM Check if Docker is running
docker version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not running!
    echo.
    echo Please:
    echo 1. Open Docker Desktop
    echo 2. Wait for it to start completely 
    echo 3. Then run this script again
    echo.
    pause
    exit /b 1
)

echo ✅ Docker is running!
echo.

REM Start all services
echo 🚀 Starting all services...
docker-compose up -d

echo.
echo 🔄 Setting up database (first time only)...
docker-compose --profile setup up api-setup

echo.
echo ✅ LearnFlow is now running!
echo.
echo 🌐 Web App:      http://localhost:3000
echo 🔧 API Server:   http://localhost:4000  
echo 📧 Email Test:   http://localhost:8025
echo.
echo Press any key to open web app in browser...
pause >nul
start http://localhost:3000