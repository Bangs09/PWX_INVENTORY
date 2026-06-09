@echo off
REM PWX Inventory Auto-Start Script
REM Place this in: C:\Users\%USERNAME%\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup

cd /d C:\Users\Packetworx\.gemini\antigravity\scratch\PWX_INVENTORY\deployment
docker compose up -d

REM Log startup
echo %date% %time% - PWX Inventory services started >> ..\pwx-inventory-startup.log
