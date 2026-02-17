# Self-Hosting Guide

This guide covers deploying Koin on your own server.

## Requirements

- Docker & Docker Compose (recommended) OR:
  - [Bun](https://bun.sh) 1.0+
  - PostgreSQL 15+
  - Node.js 18+ (for frontend build)

## Quick Start with Docker

### 1. Clone and configure

```bash
git clone https://github.com/qepo17/koin.git
cd koin
cp .env.example .env
```

### 2. Edit `.env` for production

```env
# Database (change these!)
POSTGRES_USER=koin
POSTGRES_PASSWORD=your-secure-password-here
POSTGRES_DB=koin
DATABASE_URL=postgresql://koin:your-secure-password-here@db:5432/koin

# API
PORT=3000
JWT_SECRET=generate-a-random-64-char-string-here
API_BASE_URL=https://your-domain.com/api

# Frontend
FRONTEND_URL=https://your-domain.com
VITE_API_URL=https://your-domain.com
```

> **Generate a secure JWT secret:**
> ```bash
> openssl rand -base64 48
> ```

### 3. Create production docker-compose

Create `docker-compose.prod.yml`:

```yaml
services:
  api:
    build:
      context: .
      target: prod
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - PORT=3000
      - JWT_SECRET=${JWT_SECRET}
      - API_BASE_URL=${API_BASE_URL}
      - FRONTEND_URL=${FRONTEND_URL}
      - NODE_ENV=production
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  web:
    build:
      context: ./web
      target: prod
    ports:
      - "80:80"
    environment:
      - VITE_API_URL=${VITE_API_URL}
    depends_on:
      - api
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
```

### 4. Build and run

```bash
# Build images
docker compose -f docker-compose.prod.yml build

# Start services
docker compose -f docker-compose.prod.yml up -d

# Run migrations
docker compose -f docker-compose.prod.yml exec api bun run db:migrate

# Check logs
docker compose -f docker-compose.prod.yml logs -f
```

### 5. Verify

- API: `curl http://localhost:3000/api/health` (if health endpoint exists) or try registering
- Frontend: Open `http://localhost` in browser

---

## Manual Installation (without Docker)

### 1. Set up PostgreSQL

```bash
# Install PostgreSQL (Ubuntu/Debian)
sudo apt update && sudo apt install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
```

```sql
CREATE USER koin WITH PASSWORD 'your-secure-password';
CREATE DATABASE koin OWNER koin;
\q
```

### 2. Clone and install dependencies

```bash
git clone https://github.com/qepo17/koin.git
cd koin

# Install Bun if not present
curl -fsSL https://bun.sh/install | bash

# Install API dependencies
bun install

# Install frontend dependencies
cd web && bun install && cd ..
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL=postgresql://koin:your-secure-password@localhost:5432/koin
PORT=3000
JWT_SECRET=your-64-char-random-secret
API_BASE_URL=https://your-domain.com/api
FRONTEND_URL=https://your-domain.com
NODE_ENV=production
```

### 4. Run migrations

```bash
bun run db:migrate
```

### 5. Build frontend

```bash
cd web
bun run build
cd ..
```

### 6. Start the API

```bash
bun run start
```

### 7. Serve frontend

Use nginx to serve the built frontend (`web/dist/`) and proxy API requests:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /path/to/koin/web/dist;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Running with systemd

Create `/etc/systemd/system/koin-api.service`:

```ini
[Unit]
Description=Koin Finance API
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/koin
ExecStart=/home/user/.bun/bin/bun run start
Restart=on-failure
RestartSec=10
EnvironmentFile=/path/to/koin/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable koin-api
sudo systemctl start koin-api
sudo systemctl status koin-api
```

---

## Reverse Proxy with SSL (Caddy)

Easiest way to get HTTPS:

```bash
# Install Caddy
sudo apt install caddy
```

Create `/etc/caddy/Caddyfile`:

```
your-domain.com {
    # Frontend
    root * /path/to/koin/web/dist
    file_server
    try_files {path} /index.html

    # API
    handle /api/* {
        reverse_proxy localhost:3000
    }
}
```

```bash
sudo systemctl restart caddy
```

Caddy automatically provisions SSL certificates via Let's Encrypt.

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes (prod) | Secret for signing JWTs (min 32 chars) |
| `PORT` | No | API port (default: 3000) |
| `API_BASE_URL` | No | Full URL to API (for SKILL.md generation) |
| `FRONTEND_URL` | No | Frontend URL for CORS (default: http://localhost:5173) |
| `NODE_ENV` | No | Set to `production` for prod |
| `VITE_API_URL` | Yes | API URL for frontend (build-time) |

---

## Backups

### Database backup

```bash
# Backup
docker compose exec db pg_dump -U koin koin > backup_$(date +%Y%m%d).sql

# Or without Docker
pg_dump -U koin koin > backup_$(date +%Y%m%d).sql
```

### Restore

```bash
# With Docker
cat backup.sql | docker compose exec -T db psql -U koin koin

# Without Docker
psql -U koin koin < backup.sql
```

---

## Updating

```bash
cd koin
git pull

# Rebuild and restart
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# Run any new migrations
docker compose -f docker-compose.prod.yml exec api bun run db:migrate
```

---

## Troubleshooting

### API won't start
- Check `DATABASE_URL` is correct
- Ensure PostgreSQL is running and accessible
- Check logs: `docker compose logs api` or `journalctl -u koin-api`

### Database connection refused
- Verify PostgreSQL is running: `pg_isready`
- Check firewall rules
- Ensure credentials match

### Frontend can't reach API
- Verify `VITE_API_URL` is set correctly at build time
- Check CORS: `FRONTEND_URL` should match your frontend domain
- Check browser console for errors

### Migrations fail
- Ensure database exists and user has permissions
- Check `DATABASE_URL` format

---

## Security Checklist

- [ ] Changed default database password
- [ ] Generated strong `JWT_SECRET`
- [ ] Running behind HTTPS (SSL/TLS)
- [ ] Database not exposed publicly (only localhost or internal network)
- [ ] Regular backups configured
- [ ] Firewall configured (only 80/443 exposed)
