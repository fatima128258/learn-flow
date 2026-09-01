@echo off
cd apps\api
set FORCE_COLOR=0
powershell -ExecutionPolicy Bypass -Command "npm run dev"