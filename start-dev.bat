@echo off
cd /d "%~dp0"
title Aura aqua - dev server
if not exist "public\work\project-one\video.mp4" (
  if exist "..\aurainfotech.ca-main-molten-pull\public\work\project-one\video.mp4" (
    echo Copying project one video from the original project...
    copy /y "..\aurainfotech.ca-main-molten-pull\public\work\project-one\video.mp4" "public\work\project-one\video.mp4" >nul
  )
)
echo Installing packages...
call npm install
if errorlevel 1 (
  echo npm install failed. See the messages above.
  pause
  exit /b 1
)
echo Starting the dev server at http://localhost:3001 ...
call npm run dev -- -p 3001
pause
