@echo off
echo Refreshing LearnFlow web application...
echo.
echo Rebuilding web container with text color fixes...
docker-compose up --build web -d
echo.
echo ✅ Web app updated! 
echo.
echo Please refresh your browser at http://localhost:3000
echo.
echo Opening browser...
start http://localhost:3000
echo.
echo If text is still not visible, press Ctrl+F5 to hard refresh the page.
pause