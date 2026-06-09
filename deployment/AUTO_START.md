# PWX Inventory Auto-Start Configuration

## Windows Setup (Docker Desktop)

### Step 1: Enable Docker Desktop Auto-Start
1. Open Docker Desktop
2. Settings → General
3. Enable "Start Docker Desktop when you log in"

### Step 2: Auto-Start PWX Inventory
The batch script is located at:
```
deployment/start-pwx-inventory.bat
```
Copy this file to your Startup folder:
```
C:\Users\Packetworx\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\start-pwx-inventory.bat
```

When Windows starts:
1. Docker Desktop will launch
2. PWX Inventory containers will automatically start via the batch script
3. Services will be healthy and accessible within ~60 seconds

### Step 3: Verify Auto-Start
1. Restart your machine
2. After login, wait 60 seconds
3. Run from the `deployment/` folder:
```bash
docker compose ps
# Should show both web and caddy services as "Up (healthy)"
```

### Manual Management
All commands below must be run from the `deployment/` folder:
```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# Check status
docker compose ps

# View logs
docker compose logs -f
```

---

## Linux/Production Server Setup

If deploying to a Linux server, copy the systemd service file from:
`deployment/systemd/pwx-inventory.service`
to:
`/etc/systemd/system/pwx-inventory.service`

**File Content (for reference):**
```ini
[Unit]
Description=PWX Inventory Management System (Docker Compose)
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/root/pwx-inventory/deployment
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
Restart=no

[Install]
WantedBy=multi-user.target
```

Then enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable pwx-inventory.service
sudo systemctl start pwx-inventory.service

# Verify status
sudo systemctl status pwx-inventory.service
```

---

## Docker Compose Settings

All services already have `restart: unless-stopped` in `deployment/docker-compose.yml`, which means:
- ✅ Containers auto-restart if they crash
- ✅ Containers restart after Docker daemon restarts
- ✅ Containers do NOT start if manually stopped

---

## Startup Sequence

1. **System Boot** → Docker Desktop/Daemon starts
2. **Auto-Start Script** → Executes `docker compose up -d` in the `deployment/` folder
3. **Web Service** → Starts Node.js Next.js app (~30s)
4. **Health Check** → Web service marked healthy (~40s)
5. **Caddy Service** → Starts and proxies to healthy web service (~5s)
6. **System Ready** → All services operational (~60s total)

---

## Monitoring Auto-Start

Check the startup log (created in the repository root folder):
```bash
cat pwx-inventory-startup.log
```

This logs each time the containers are auto-started.

---

## Disable Auto-Start (if needed)

### Windows:
Delete the batch script from Startup folder or disable it in Task Scheduler.

### Linux:
```bash
sudo systemctl disable pwx-inventory.service
```
