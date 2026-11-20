@echo off
setlocal
chcp 65001 >nul
title LocalLink Launcher
pushd "%~dp0desktop"
if errorlevel 1 goto directory_error

if not exist "node_modules\electron\dist\electron.exe" goto setup
if not exist "node_modules\better-sqlite3\build\Release\better_sqlite3.node" goto setup
if not exist "node_modules\selfsigned\package.json" goto setup
goto ready

:setup
echo Installing LocalLink desktop dependencies. Internet access is required.
where node >nul 2>&1
if errorlevel 1 goto missing_node
where npm.cmd >nul 2>&1
if errorlevel 1 goto missing_node
call npm.cmd ci
if errorlevel 1 goto failed
node node_modules\electron\install.js
if errorlevel 1 goto failed
call node_modules\.bin\electron-builder.cmd install-app-deps
if errorlevel 1 goto failed

:ready
rem Clear an inherited Electron Node-mode flag before starting the GUI.
set "ELECTRON_RUN_AS_NODE="
if /i "%~1"=="--check" goto check
echo Starting LocalLink. Close the app from its tray menu to exit completely.
"node_modules\electron\dist\electron.exe" .
if errorlevel 1 goto failed
popd
exit /b 0

:check
set "ELECTRON_RUN_AS_NODE=1"
"node_modules\electron\dist\electron.exe" -e "const DB=require('better-sqlite3');const db=new DB(':memory:');db.close();console.log('LocalLink launcher check passed.');"
if errorlevel 1 goto failed
popd
exit /b 0

:missing_node
echo Node.js and npm are required for the first installation. Install Node.js, then retry.
goto failed

:directory_error
echo Cannot find the desktop folder beside this BAT file.
pause
exit /b 1

:failed
echo.
echo LocalLink could not start. The error details are shown above.
echo For native-module errors, run in desktop: npx --no-install electron-builder install-app-deps
popd
if /i "%~1"=="--check" exit /b 1
pause
exit /b 1
