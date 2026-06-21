@echo off
chcp 65001 >nul
title Messenger - Tunnel
echo ========================================
echo   Messenger - Туннель для телефона
echo ========================================
echo.
echo Запуск сервера...
cd /d "%~dp0"

start /min node server/src/index.js
echo Сервер запущен на порту 3001
echo.

echo Запуск туннеля...
echo (подождите 10-15 секунд)
echo.
npx localtunnel --port 3001

pause
