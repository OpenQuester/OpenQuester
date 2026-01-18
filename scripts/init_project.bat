@echo off
setlocal enabledelayedexpansion

REM init_project.bat - Initialize OpenQuester project
REM This script builds the project_helper tool and creates symlinks

set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
set "CLIENT_DIR=%PROJECT_ROOT%\client"
set "PROJECT_HELPER_DIR=%CLIENT_DIR%\packages\project_helper"

echo ========================================
echo   OpenQuester Project Initialization
echo ========================================
echo.

REM Check if puro should be used
if "%DONT_USE_PURO%"=="true" (
    set "DART_CMD=dart"
    set "FLUTTER_CMD=flutter"
) else (
    set "DART_CMD=puro dart"
    set "FLUTTER_CMD=puro flutter"
)

REM Build project_helper
echo Building project_helper...
cd /d "%PROJECT_HELPER_DIR%"

REM Get dependencies
echo Getting dependencies...
%DART_CMD% pub get

REM Compile executable
echo Compiling oqhelper executable...
%DART_CMD% compile exe bin\oqhelper.dart -o bin\oqhelper.exe

if not exist "bin\oqhelper.exe" (
    echo X Failed to compile oqhelper
    exit /b 1
)

echo √ oqhelper compiled successfully

REM Create symlinks in all Dart project roots
echo.
echo Creating symlinks...

REM Function to create symlink
REM On Windows, we'll create hard links to the executable
REM Note: Requires NTFS filesystem

REM Link to client directory (main Flutter app)
set "TARGET=%PROJECT_HELPER_DIR%\bin\oqhelper.exe"
set "LINK=%CLIENT_DIR%\oqhelper.exe"
if exist "%LINK%" del "%LINK%"
mklink /H "%LINK%" "%TARGET%" >nul 2>&1
if errorlevel 1 (
    echo   ! Failed to create hard link, copying instead...
    copy /Y "%TARGET%" "%LINK%" >nul
)
echo   √ Linked: %CLIENT_DIR%\oqhelper.exe

REM Link to all packages
for /d %%p in ("%CLIENT_DIR%\packages\*") do (
    if exist "%%p\pubspec.yaml" (
        set "LINK=%%p\oqhelper.exe"
        if exist "!LINK!" del "!LINK!"
        mklink /H "!LINK!" "%TARGET%" >nul 2>&1
        if errorlevel 1 (
            copy /Y "%TARGET%" "!LINK!" >nul
        )
        echo   √ Linked: %%p\oqhelper.exe
    )
)

echo.
echo ========================================
echo   Initialization Complete!
echo ========================================
echo.
echo You can now use 'oqhelper' command in any Dart project directory:
echo   cd %CLIENT_DIR%
echo   oqhelper pre_build
echo.

endlocal
