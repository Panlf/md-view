@echo off
setlocal
chcp 65001 >nul 2>&1

REM ============================================================
REM  build-release.bat - Release build script
REM
REM  Usage:
REM    build-release.bat                      # Build both Lite + Plus
REM    build-release.bat lite                 # Lite only
REM    build-release.bat plus                 # Plus only
REM    build-release.bat both                 # Lite + Plus
REM    build-release.bat both --no-bundle     # Portable exe only, skip NSIS
REM ============================================================

cd /d "%~dp0.."

where node >nul 2>&1
if errorlevel 1 (
    echo [Error] node not found. Please install Node.js and add it to PATH.
    pause
    exit /b 1
)

if "%~1"=="" (
    set "ARGS=both"
) else (
    set "ARGS=%*"
)

echo.
echo ============================================
echo   Start release build
echo   Args: %ARGS%
echo ============================================
echo.

node scripts/package-local.mjs %ARGS%
set "EXITCODE=%ERRORLEVEL%"

if %EXITCODE% neq 0 (
    echo.
    echo [Error] Build failed, exit code %EXITCODE%
    pause
    exit /b %EXITCODE%
)

echo.
echo [Done] Release artifacts in release\ directory
pause
endlocal