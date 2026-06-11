# Showstack — Server Deployment Guide (Docker)

## Prerequisites

Your server needs:
- **Docker** ≥ 24 and **Docker Compose** v2 (`docker compose` not `docker-compose`)
- **cloudflared** (for the Cloudflare Tunnel)
- Git (to pull the repo)

```bash
# Install Docker (Ubuntu/Debian)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # re-login after this

# Install cloudflared (Ubuntu/Debian)
curl -L https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg > /dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared focal main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install -y cloudflared
```

---

## Step 1 — Copy files to the server

```bash
# Clone the repo
git clone https://github.com/reydisse/countdown-studio /opt/showstack
cd /opt/showstack
```

---

## Step 2 — Configure environment

```bash
cd /opt/showstack
cp .env.example .env   # or the .env file is already included
nano .env
```

Fill in the values:

| Variable | Notes |
|---|---|
| `PORT` | Leave as `9876` unless you have a conflict |
| `R2_ACCOUNT_ID` … `R2_PUBLIC_URL` | Optional — leave blank to use local disk storage |

---

## Step 3 — Build and start the container

```bash
cd /opt/showstack
docker compose up -d --build
```

Check that it's running:

```bash
docker compose ps
docker compose logs -f    # Ctrl+C to exit
```

The app will be live at `http://localhost:9876`. Verify with:

```bash
curl http://localhost:9876/api/health
```

---

## Step 4 — Set up the Cloudflare Tunnel

```bash
# Log in (opens a browser URL — paste it into your local browser)
cloudflared tunnel login

# Create the tunnel (run once)
cloudflared tunnel create showstack
# ↑ Prints a Tunnel ID — copy it
```

Edit `cloudflared.yml` (already in the repo root):
- Replace `<TUNNEL_ID>` with the ID from above
- Confirm the `hostname` matches your domain

```bash
# Copy config to the right place
mkdir -p ~/.cloudflared
cp cloudflared.yml ~/.cloudflared/config.yml

# Install and start as a system service
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

Then in the **Cloudflare dashboard → DNS**:
- Add a CNAME record: `countdownstudio` → `<TUNNEL_ID>.cfargotunnel.com` (Proxied ✓)

---

## Managing the container

| Command | What it does |
|---|---|
| `docker compose up -d` | Start (detached) |
| `docker compose down` | Stop |
| `docker compose restart showstack` | Restart |
| `docker compose logs -f` | Tail logs |
| `docker compose pull && docker compose up -d --build` | Update after code changes |

Data (database + media) is stored in named Docker volumes and persists across restarts and rebuilds.

---

## Updating

```bash
cd /opt/showstack
git pull                          # or rsync new files
docker compose up -d --build      # rebuilds the image, restarts the container
```

---

## Troubleshooting

**Container exits immediately** — check logs: `docker compose logs showstack`

**Port already in use** — change `PORT` in `.env` and update the `ports` mapping in `docker-compose.yml`

**Cloudflare tunnel not connecting** — run `cloudflared tunnel info showstack` and verify the CNAME in the dashboard matches

**Database issues** — the SQLite DB lives in the `showstack_db` Docker volume at `/app/data/db` inside the container. To inspect: `docker exec -it showstack sh`
