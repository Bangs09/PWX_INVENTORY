# PWX Inventory - Public Deployment Checklist

## Pre-Deployment Setup

1. **Domain & DNS**
   - [ ] Domain `pwxnetteam.dpdns.org` is registered and resolving
   - [ ] Firewall allows inbound TCP 80/443
   - [ ] DNS A record points to server IP

2. **Server Requirements**
   - [ ] Docker 20.10+ installed
   - [ ] Docker Compose 2.0+ installed
   - [ ] Minimum 2GB RAM, 5GB disk space
   - [ ] Linux server recommended (or Docker Desktop on development)

3. **Clone/Copy Project**
   ```bash
   git clone <your-repo> pwx-inventory
   cd pwx-inventory
   ```

## Deployment Steps

### Step 1: Build & Start Services
```bash
# Build the Next.js image
docker compose build

# Start all services in background
docker compose up -d

# Verify services running
docker compose ps
```

Expected output: Both `pwx-inventory-web` and `pwx-inventory-caddy` should show `Up` status.

### Step 2: Initialize Database (First Time Only)
```bash
# Wait 10 seconds for web service to be fully ready
sleep 10

# Initialize database
docker compose exec web npm run db:init

# Optional: Seed with sample inventory data
docker compose exec web npm run db:migrate:all
```

### Step 3: Verify SSL Certificate
```bash
# Check Caddy logs for certificate provisioning
docker compose logs caddy | grep -i "certificate\|ssl\|tls"

# Should see: "Provisioned certificate" or similar within 30 seconds
```

### Step 4: Test Public Access
```bash
# From your local machine or external server:
curl -I https://pwxnetteam.dpdns.org

# Expected response: HTTP/2 200 or 3xx redirect
```

## Post-Deployment

### Health Checks
```bash
# Check container health
docker compose ps
# web should show: (healthy) or Up

# View logs
docker compose logs -f web
docker compose logs -f caddy
```

### Backup Database
```bash
# Create backup directory
mkdir -p backups

# Backup database
docker compose exec web tar czf - /app/data/ > backups/db-$(date +%Y%m%d-%H%M%S).tar.gz
```

### Auto-Renewal (Caddy Handles This)
Caddy automatically renews SSL certificates before expiration. No action needed.

## Troubleshooting

### Services Won't Start
```bash
docker compose logs
# Check for port conflicts (80/443 already in use)
# Check for out-of-disk space
```

### Database Connection Failed
```bash
docker compose exec web npm run db:check
docker compose logs web
```

### Certificate Not Provisioning
```bash
# Ensure domain resolves
nslookup pwxnetteam.dpdns.org

# Check Caddy can reach ACME servers (needs internet)
docker compose logs caddy

# Verify Caddyfile syntax
docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile
```

### Application Not Responding
```bash
# Restart web service
docker compose restart web

# Force health check
docker compose exec web node -e "require('http').get('http://localhost:3000', (r) => console.log(r.statusCode))"
```

## Maintenance

### Update Application
```bash
git pull origin main
docker compose build --no-cache
docker compose up -d
```

### View Database Logs
```bash
docker compose exec web npm run db:check
```

### Stop All Services
```bash
docker compose down
# Database persists in ./data volume
```

### Full Cleanup (Destructive)
```bash
docker compose down -v
# Removes all volumes - database will be lost!
```

## Performance Monitoring

```bash
# Real-time resource usage
docker stats

# Container resource limits
docker inspect pwx-inventory-web | grep -A 5 "Memory"
```

## Network Architecture

```
Internet (HTTPS/443)
    ↓
Caddy (pwx-inventory-caddy)
    ↓ (HTTP/3000 internal)
Next.js App (pwx-inventory-web)
    ↓
SQLite Database (/app/data/database.sqlite)
```

## Security Notes

- ✅ TLS 1.3 enforced by Caddy
- ✅ Next.js runs as non-root user (uid 1001)
- ✅ CSP headers configured
- ✅ Log rotation enabled (10MB max)
- ✅ Health checks prevent zombie containers

## Support Files

- `Dockerfile` - Multi-stage production build
- `docker-compose.yml` - Service orchestration
- `.dockerignore` - Build context optimization
- `Caddyfile` - Reverse proxy & SSL
- `DEPLOYMENT.md` - Detailed deployment guide
