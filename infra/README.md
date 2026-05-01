# Infra Directory - Waha & Redis Configuration

This folder contains Dockerfiles and Railway configurations for the additional services required by Renostter Agente IA.

## Files

| File | Purpose |
|---|---|
| `waha.Dockerfile` | Docker image for Waha Core (WhatsApp API) |
| `waha.railway.toml` | Railway deployment config for Waha service |
| `redis.conf` | Redis server configuration |
| `redis.railway.toml` | Railway deployment config for Redis service |

## Services Architecture

```
[WhatsApp User]
       │
       ▼
[Waha Core] ← waha.Dockerfile
   (devlikeapro/waha:latest)
       │
       ▼ webhook POST
[Next.js App] ← main app (renostter-agente-ia)
       │
       ├──> [Redis] ← redis.conf (debounce)
       └──> [Postgres] (prisma schema)
```

## Adding Services to Railway

### Waha Core
```bash
# In Railway dashboard:
# 1. Add service → "Empty Service"
# 2. Connect to GitHub repo
# 3. Set Root Directory: `infra/`
# 4. Railway will use waha.railway.toml automatically
# 5. Set environment variables:
#    - WAHA_HOOK_EVENTS=message,session.status
```

### Redis
```bash
# Option A: Railway Plugin (Recommended)
# Dashboard → "New Service" → "Database" → "Redis"

# Option B: Custom Redis with redis.railway.toml
# Dashboard → "Empty Service" → Connect repo → Set config file path
```

## Private Networking (Railway IPv6)

All services communicate via Railway internal networking:

| Service | Internal URL |
|---|---|
| App | `app.railway.internal:3000` |
| Postgres | `postgres.railway.internal:5432` |
| Redis | `redis.railway.internal:6379` |
| Waha | `waha.railway.internal:8080` |

## Environment Variables

### In `renostter-agente-ia/.env` (App Service):
```
WAHA_BASE_URL=http://waha.railway.internal:8080
WAHA_HOOK_EVENTS=message,session.status
REDIS_URL=redis://redis.railway.internal:6379
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

## Notes

- Waha Core uses GOWS engine (no browser required, text-only)
- Redis is used for message debounce (5s default window)
- All services use Railway private networking (IPv6)
- No Docker Compose needed - Railway handles orchestration
