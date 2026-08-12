@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo       GitHub Push Helper Script
echo ==========================================

:: Check if git is initialized
if not exist .git (
    echo [INFO] Git repository not found. Initializing...
    git init -b main
    if errorlevel 1 (
        echo [ERROR] Failed to initialize Git repository.
        pause
        exit /b 1
    )
)

:: Check if remote 'origin' exists
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo [INFO] Adding remote origin...
    git remote add origin https://github.com/testingemail2022w-bit/Wedding-face-recognisation-system.git
    if errorlevel 1 (
        echo [ERROR] Failed to add remote origin.
        pause
        exit /b 1
    )
) else (
    echo [INFO] Updating remote origin URL...
    git remote set-url origin https://github.com/testingemail2022w-bit/Wedding-face-recognisation-system.git
)

:: Prompt user for custom commit message
set "commit_msg="
set /p "commit_msg=Enter commit message (default: Update): "

if "!commit_msg!"=="" (
    set "commit_msg=Update"
)

echo.
echo [INFO] Staging all files...
git add .

echo [INFO] Committing changes with message: "!commit_msg!"
git commit -m "!commit_msg!"

echo [INFO] Pushing to GitHub (main branch)...
git push -u origin main

if errorlevel 1 (
    echo.
    echo [ERROR] Push failed. Please check your GitHub credentials or connection.
) else (
    echo.
    echo [SUCCESS] Code pushed to GitHub successfully!
)

pause
