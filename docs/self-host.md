# Self-hosting the Server

The Server is optional: the desktop app is local-first and works without one. Deploy it when you want a mirror of what the app records.

The shape: a Docker compose stack on a VPS — the server image from GHCR, Postgres 17 with a named volume, and `cloudflared` holding a Cloudflare Tunnel open. The tunnel gives the Server an HTTPS hostname on your Cloudflare domain; the VPS publishes no ports. The target is a Hetzner Cloud VPS, but any Linux host with Docker works.

Commands below run on the VPS from `/opt/time-stop` unless stated.

## Prerequisites

- A VPS with Docker Engine and the compose plugin. The image is published for `linux/amd64` and `linux/arm64`, so any Hetzner Cloud server type works, x86 or Arm; `docker compose pull` picks the matching one.
- A domain whose DNS is on Cloudflare, and access to its Cloudflare Zero Trust dashboard (the free plan covers tunnels).
- A [released](release.md) version of Time Stop. One git tag versions both the desktop app and the server image; run the Server on the same version as the app. Until the first release is tagged, [build the image from source](#before-the-first-release-build-from-source).

## 1. Firewall

The tunnel dials out, so the VPS needs no inbound ports besides SSH. In a Hetzner Cloud firewall, allow inbound TCP 22 only.

## 2. Cloudflare Tunnel

In the Zero Trust dashboard, create a tunnel of type Cloudflared and copy its token; `cloudflared` reads it as `TUNNEL_TOKEN` below. Skip the connector install steps the dashboard offers — the compose stack runs the connector.

Add a public hostname to the tunnel:

| Field    | Value                  |
| -------- | ---------------------- |
| Hostname | `timestop.example.com` |
| Service  | `HTTP`, `server:3000`  |

`server` is the compose service name; `cloudflared` resolves it on the stack's network.

Leave Cloudflare Access off this hostname. The app authenticates each push with its Token only and cannot answer an Access login.

## 3. Compose stack

Create the directory:

```bash
sudo mkdir -p /opt/time-stop && sudo chown "$USER" /opt/time-stop
```

Save as `/opt/time-stop/compose.yaml`:

```yaml
services:
  server:
    image: ghcr.io/konfrontend/time-stop-server:${SERVER_VERSION}
    restart: unless-stopped
    environment:
      PORT: '3000'
      DATABASE_URL: postgres://app:${POSTGRES_PASSWORD}@postgres:5432/app
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:17
    restart: unless-stopped
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: app
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U app -d app']
      interval: 5s
      timeout: 3s
      retries: 10

  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      TUNNEL_TOKEN: ${TUNNEL_TOKEN}
    depends_on:
      server:
        condition: service_healthy

volumes:
  postgres-data:
```

It differs from the repo's development [`compose.yaml`](../compose.yaml) on purpose: it pulls the image instead of building it, publishes no ports, reads secrets from `.env`, and adds `cloudflared`. The server's health check comes from its [`Dockerfile`](../apps/server/Dockerfile).


## 4. Environment

Generate a Postgres password. Hex keeps it safe inside `DATABASE_URL`:

```bash
openssl rand -hex 32
```

Save as `/opt/time-stop/.env`:

```dotenv
SERVER_VERSION=0.1.0
POSTGRES_PASSWORD=<the generated password>
TUNNEL_TOKEN=<the tunnel token from step 2>
```

`SERVER_VERSION` is the release version without the leading `v`.

Keep the file readable by you only:

```bash
chmod 600 .env
```

Postgres applies `POSTGRES_PASSWORD` only when it initializes an empty volume. Changing it later in `.env` does not change the database user's password.

## 5. Start

While the GHCR package is private, log in first with a GitHub personal access token (classic) that has the `read:packages` scope. Paste the token at the password prompt so it stays out of shell history:

```bash
docker login ghcr.io -u <github username>
```

Pull and start:

```bash
docker compose pull
```

```bash
docker compose up -d
```

The server applies pending database migrations on boot, before it listens. All three services should reach `running`, and `server` and `postgres` should show `healthy`:

```bash
docker compose ps
```

From any machine, through the tunnel:

```bash
curl https://timestop.example.com/health
```

It answers `{"status":"ok"}`.

## 6. Mint a Token

Each Install needs its own Token. The Token is printed once; only its hash is stored:

```bash
docker compose exec server node apps/server/dist/cli.js mint
```

It prints a Token id and the Token. Keep the Token id; revoking needs it.

## 7. Connect the desktop app

In the app, open Settings → Server:

- Server URL: `https://timestop.example.com`. Always use the `https://` hostname; the Token travels in a header on every push.
- Token: the `tst_…` value from step 6.

Save. The app pushes every Change not yet sent, including those recorded before a Server existed. The first push binds the Token to this Install and its Actor. Settings shows the last push and how many Changes are waiting.

## Upgrade

Set the new version in `.env`, then pull and restart. Migrations run on boot:

```bash
docker compose pull
```

```bash
docker compose up -d
```

While the Server is down, the app queues Changes and retries until they land.

## Rotate or revoke a Token

Revoke by Token id:

```bash
docker compose exec server node apps/server/dist/cli.js revoke <token id>
```

The Install using it stops pushing and says so in Settings; its Changes keep queueing locally. Mint a new Token and paste it into Settings → Server to resume.

A Token bound to one Install is rejected from any other. A reinstalled app generates a fresh `installId` and needs a new Token.

## Backup

The desktop app is the source of truth; the Server only mirrors it. The app never pushes a Change twice, so a lost Postgres volume is not refilled from the app. The volume also holds the Token hashes: without a restore, pushes answer 401 until you mint and paste a new Token. Back the mirror up if you want to keep it.

Dump the database to a file on the VPS:

```bash
docker compose exec -T postgres pg_dump -U app -d app > "timestop-$(date +%F).sql"
```

Copy dumps off the VPS; a dump next to the volume it backs up does not survive losing the VPS.

To restore into a fresh volume, start Postgres alone and wait for it to be healthy, load the dump, then start the rest:

```bash
docker compose up -d --wait postgres
```

```bash
docker compose exec -T postgres psql -U app -d app < timestop-YYYY-MM-DD.sql
```

```bash
docker compose up -d
```

## Troubleshooting

Logs per service:

```bash
docker compose logs -f server
```

```bash
docker compose logs -f cloudflared
```

What Settings → Server shows, by cause:

| Settings shows                     | Cause                                             | Fix                                                        |
| ---------------------------------- | ------------------------------------------------- | ---------------------------------------------------------- |
| `Retrying: fetch failed`           | Hostname or network unreachable                   | Check the hostname and your connection                     |
| `Retrying: 502 …`, `Retrying: 530` | `cloudflared` or `server` down                    | Check `docker compose ps` and the logs                     |
| `Pushing stopped: 401 Token …`     | Token unknown or revoked                          | Mint a new Token and paste it                              |
| `Pushing stopped: 403 Token …`     | Token bound to a different Install and Actor pair | Mint a Token for this Install and paste it                 |
| `Pushing stopped: 400 …`           | The Server rejects the batch shape                | Run the Server on the app's version, then relaunch the app |

Retrying never gives up; the app backs off up to five minutes between attempts. Pushing stopped stays stopped until a Token is saved in Settings → Server or the app relaunches.

Status codes and the batch shape: [apps/server/README.md](../apps/server/README.md#pushing-changes).

## Before the first release: build from source

Until a tagged release publishes the image to GHCR, build it on the VPS under the same name, then follow the steps above with two changes.

Clone the repo and build from its root. While the repo is private, the clone needs credentials on the VPS: a GitHub personal access token with read access to the repo, pasted at the password prompt, or a read-only deploy key.

```bash
git clone https://github.com/konfrontend/timestop.git ~/timestop
```

```bash
docker build -f ~/timestop/apps/server/Dockerfile -t ghcr.io/konfrontend/time-stop-server:dev ~/timestop
```

Then:

- Set `SERVER_VERSION=dev` in `.env`.
- Skip `docker login` and `docker compose pull`; `docker compose up -d` uses the local image.

To upgrade, `git pull` in `~/timestop`, rebuild, and run `docker compose up -d`.
