# PWX Inventory - Docker Deployment Guide

## Prerequisites
- Docker & Docker Compose installed
- Domain configured and pointing to your server (pwxnetteam.dpdns.org)
- Ports 80 and 443 accessible

## Quick Start

### 1. Prepare Environment
From the repository root directory:
```bash
cp .env.production.example .env.production
# Edit .env.production with your production values
```

### 2. Build & Deploy
Change to the `deployment` directory and start the services:
```bash
cd deployment
docker compose up -d
```

Caddy will automatically:
- Provision TLS certificates for your domain (pwxnetteam.dpdns.org)
- Reverse proxy traffic to the Next.js app
- Handle renewals

### 3. Initialize Database (First Time)
Run this from the `deployment` directory:
```bash
# Run inside the container
docker compose exec web npm run db:init
```

### 4. Verify Deployment
Run from the `deployment` directory:
```bash
# Check service status
docker compose ps

# View logs
docker compose logs -f web
docker compose logs -f caddy

# Test the endpoint
curl https://pwxnetteam.dpdns.org
```

## Production Checklist

- [ ] Domain DNS is configured and resolvable
- [ ] Ports 80/443 are open on your firewall
- [ ] Environment variables are set in the root `.env.production`
- [ ] Database initialized with `npm run db:init`
- [ ] SSL/TLS certificate provisioned (check Caddy logs)
- [ ] Application responding on https://pwxnetteam.dpdns.org
- [ ] Health checks passing (`docker compose ps`)

## Management
All commands below should be run from the `deployment/` directory.

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f web
docker compose logs -f caddy
```

### Database Migrations
```bash
docker compose exec web npm run db:migrate
docker compose exec web npm run db:migrate:all
docker compose exec web npm run db:fix-admin
```

### Restart Services
```bash
docker compose restart web
docker compose restart caddy
```

### Full Rebuild
```bash
docker compose down
docker compose up --build -d
```

## Troubleshooting

### Certificate Issues
```bash
docker compose logs caddy
# Check if domain resolves: nslookup pwxnetteam.dpdns.org
```

### Database Connection Failed
```bash
docker compose exec web npm run db:check
```

### Application Not Responding
```bash
docker compose ps  # Check health status
docker compose logs web
```

### Disk Space Issues
```bash
docker system df
docker system prune -a
```

## Security Notes

- App runs as non-root user (nextjs:1001)
- TLS termination via Caddy
- HTTP automatically redirects to HTTPS
- CSP headers configured in Next.js
- SQLite database persisted in the `data/` volume (saved in the repository root)

## Backup

Database is stored in `../data/database.sqlite` (relative to the `deployment/` folder). Backup regularly:
```bash
docker compose exec web tar czf /tmp/db-backup.tar.gz /app/data/
docker cp pwx-inventory-web:/tmp/db-backup.tar.gz ../backup/
```

## Performance Tips

- Configure Caddy resource limits in `docker-compose.yml`
- Monitor with `docker stats`
- Enable log rotation (already configured)
- Set memory limits on services if needed
