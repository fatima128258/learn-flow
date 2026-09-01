@echo off
cd apps\web
set FORCE_COLOR=0
powershell -ExecutionPolicy Bypass -Command "npm run dev"