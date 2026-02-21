# Self-Hosting Fluxer with Docker

Quick guide to self-host Fluxer using Docker Compose.

## Prerequisites

- Docker 24+ and Docker Compose v2
- A domain pointed at your server
- Ports open: 80, 443 (web), and for voice: 3478/udp, 7881/tcp, 50000-50100/udp

## Quick Start

### 1. Clone and Build

```bash
git clone https://github.com/Thalpy/fluxer-mod.git
cd fluxer-mod
docker build -t fluxer-server:local -f fluxer_server/Dockerfile .
```

### 2. Configure

```bash
# Copy the template
cp config/config.docker.template.json config/config.json

# Generate secrets and edit config
nano config/config.json
```

Replace all `GENERATE_WITH_*` placeholders:

```bash
# Generate a 64-char hex secret
openssl rand -hex 32

# Generate VAPID keys for push notifications
node -e "
const crypto = require('crypto');
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
console.log('Public:', publicKey.export({ type: 'spki', format: 'der' }).slice(27).toString('base64url'));
console.log('Private:', privateKey.export({ type: 'pkcs8', format: 'der' }).slice(36).toString('base64url'));
"
```

Set `domain.base_domain` to your domain (e.g., `chat.example.com`).

### 3. Launch

```bash
# Basic (no search, no voice)
docker compose -f docker-compose.local.yaml up -d

# With Meilisearch for full-text search
docker compose -f docker-compose.local.yaml --profile search up -d

# With voice/video (LiveKit)
docker compose -f docker-compose.local.yaml --profile voice up -d

# With both
docker compose -f docker-compose.local.yaml --profile search --profile voice up -d

# Check status
docker compose -f docker-compose.local.yaml ps

# View logs
docker compose -f docker-compose.local.yaml logs -f fluxer
```

### 4. Access

Open `http://your-server:8080` in your browser.

For production, put nginx or Caddy in front for HTTPS.

## Optional Features

### Meilisearch (Full-Text Search)

1. Set `MEILI_MASTER_KEY` environment variable or edit compose file
2. Use the same key in `config/config.json` under `integrations.search.api_key`
3. Start with `--profile search`

### LiveKit (Voice/Video)

1. Open firewall ports: 7881/tcp, 3478/udp, 50000-50100/udp
2. Create `config/livekit.yaml` (see LiveKit docs)
3. Set `integrations.voice.enabled: true` in config
4. Start with `--profile voice`

## Useful Commands

```bash
# Stop everything
docker compose -f docker-compose.local.yaml down

# Restart fluxer after config changes
docker compose -f docker-compose.local.yaml restart fluxer

# View logs
docker compose -f docker-compose.local.yaml logs -f

# Full reset (deletes data!)
docker compose -f docker-compose.local.yaml down -v
```

## Voice/Video (Optional)

For voice and video calls, you'll also need LiveKit. See the main README for port requirements.
