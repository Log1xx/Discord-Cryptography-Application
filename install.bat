@echo off
title Node Module Installer
echo ================================
echo Installing Node dependencies...
echo ================================

:: Check if Node.js is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js is not installed!
    echo Please install Node.js first.
    pause
    exit /b
)

:: Initialize package.json if it doesn't exist
if not exist package.json (
    echo Creating package.json...
    npm init -y
)

:: Install required modules
echo Installing dotenv, discord.js, node path, and node fs...
npm install dotenv discord.js path fs

echo.
echo ================================
echo Installation complete!
echo ================================
pause
