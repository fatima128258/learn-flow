@echo off
echo ========================================
echo Fixing Git - Removing node_modules
echo ========================================
echo.
echo This will:
echo 1. Remove node_modules from Git history
echo 2. Keep your local node_modules intact
echo 3. Update .gitignore
echo 4. Create fresh commit
echo.
pause

cd /d "c:\Users\Rajpoot Qamar Abbas\Desktop\learnflow"

echo.
echo Step 1: Removing node_modules from Git cache...
git rm -r --cached apps/web/node_modules
git rm -r --cached apps/api/node_modules
git rm -r --cached node_modules

echo.
echo Step 2: Committing changes...
git add .gitignore
git commit -m "fix: Remove node_modules from Git tracking"

echo.
echo Step 3: Checking repository size...
git count-objects -vH

echo.
echo ========================================
echo Done! Now you can push:
echo   git push -u origin master
echo ========================================
echo.
pause
