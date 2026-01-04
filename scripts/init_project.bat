@echo off
setlocal enabledelayedexpansion

REM init_project.bat - Initialize OpenQuester project
REM This script builds the project_helper tool and creates symlinks

set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%"
set "CLIENT_DIR=%PROJECT_ROOT%client"
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
REM Note: On Windows, we'll copy the executable instead of creating symlinks
REM as symlinks require admin privileges

REM Copy to client directory (main Flutter app)
copy /Y "%PROJECT_HELPER_DIR%\bin\oqhelper.exe" "%CLIENT_DIR%\oqhelper.exe" >nul
echo   √ Copied: %CLIENT_DIR%\oqhelper.exe

REM Copy to all packages
for /d %%p in ("%CLIENT_DIR%\packages\*") do (
    if exist "%%p\pubspec.yaml" (
        copy /Y "%PROJECT_HELPER_DIR%\bin\oqhelper.exe" "%%p\oqhelper.exe" >nul
        echo   √ Copied: %%p\oqhelper.exe
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
