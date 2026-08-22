@echo off
echo ========================================
echo Starting LearnFlow...
echo ========================================
echo.

cd /d "c:\Users\Rajpoot Qamar Abbas\Desktop\learnflow"
docker compose up -d

echo.
echo ========================================
echo LearnFlow is running!
echo Open: http://localhost:3000
echo ========================================
echo.
pause
