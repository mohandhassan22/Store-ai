@echo off
title Run Python Backend and Ngrok
echo Starting backend...
start cmd /k "python backend.py"
timeout /t 5 >nul
echo Starting ngrok...
start cmd /k "ngrok http 5000"
echo All services started.
