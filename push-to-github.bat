@echo off
rem Pushes this folder to GitHub (aura-nexus, main branch), replacing what is there.
rem The old version stays in the repo's history.
cd /d "%~dp0"
set LOG=push-log.txt
echo ==== %date% %time% > %LOG%
if not exist .git (
  git init -b main >> %LOG% 2>&1
  git remote add origin https://github.com/dilanthandilan11-sketch/aura-nexus.git >> %LOG% 2>&1
  echo push-log.txt>> .git\info\exclude
  echo push-to-github.bat>> .git\info\exclude
  echo .idea/>> .git\info\exclude
)
echo Fetching...
git fetch origin main >> %LOG% 2>&1
if errorlevel 1 goto fail
git reset origin/main >> %LOG% 2>&1
git add -A >> %LOG% 2>&1
echo Committing...
git commit -m "Replace site with the aqua landing version" -m "Water hero with rocks and marble A, dive light under the waterline, liquid buttons, scramble nav." -m "Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01C2JvqBKFPWCqbbrgHEryik" >> %LOG% 2>&1
echo Pushing...
git push -u origin HEAD:main >> %LOG% 2>&1
if errorlevel 1 goto fail
echo RESULT: DONE >> %LOG%
echo Done. Pushed to GitHub.
pause
exit /b 0
:fail
echo RESULT: FAILED >> %LOG%
echo Something failed. See push-log.txt in this folder.
pause
exit /b 1
