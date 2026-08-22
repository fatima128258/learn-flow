@echo off
echo ========================================
echo FORCE PUSH - Use ONLY if fix-git.bat failed
echo ========================================
echo.
echo WARNING: This will:
echo - Delete ALL Git history
echo - Create fresh initial commit
echo - Force push to GitHub
echo.
echo ONLY use if normal push still fails!
echo.
pause

cd /d "c:\Users\Rajpoot Qamar Abbas\Desktop\learnflow"

echo.
echo Step 1: Backing up current branch...
git branch backup-before-force

echo.
echo Step 2: Creating fresh orphan branch...
git checkout --orphan temp-clean

echo.
echo Step 3: Adding all files (except node_modules)...
git add -A

echo.
echo Step 4: Creating fresh commit...
git commit -m "Initial commit - LearnFlow with professional UI"

echo.
echo Step 5: Deleting old master...
git branch -D master

echo.
echo Step 6: Renaming to master...
git branch -m master

echo.
echo Step 7: Force pushing to GitHub...
git push -f origin master

echo.
echo ========================================
echo Done! Your repo is now clean.
echo ========================================
echo.
pause
