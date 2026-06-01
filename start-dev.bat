@echo off
cd /d "%~dp0"
title NOLINE AI STUDIO - Serveur local
echo.
echo ============================================
echo  NOLINE AI STUDIO
echo  Serveur local Next.js
echo ============================================
echo.
echo Laisse cette fenetre ouverte.
echo Quand tu vois "Ready", ouvre :
echo http://127.0.0.1:3000
echo.
"C:\Program Files\nodejs\node.exe" "%~dp0node_modules\next\dist\bin\next" dev --hostname 127.0.0.1 --port 3000
echo.
echo Le serveur s'est arrete. Appuie sur une touche pour fermer.
pause >nul
