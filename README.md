# Extractor

A browser-based incremental clicker game. Click the planet to extract ore, build drones, and industrialise the galaxy — all while watching the planet visually degrade beneath your mining operation. Fully mobile-friendly with cloud save and a cross-device leaderboard.

![Docker](https://img.shields.io/badge/docker-ghcr.io-blue)

## Gameplay

Click the planet to earn ore. Spend ore on drones. Drones auto-produce resources every frame. Spend research points on upgrades that compound into massive production multipliers. When a planet is sufficiently exhausted, travel to the next one for higher yields.

### Planets

| Planet | Unlock | Yield | Damage Threshold |
|---|---|---|---|
| **Earth** | Start | 1× | 5,000 ore |
| **Arid** | 3,000 total ore | 2.5× | 30,000 ore |
| **Frozen** | 25,000 total ore | 7× | 200,000 ore |
| **Void** | 200,000 total ore | 20× | 2,000,000 ore |

Each planet has a unique canvas-rendered surface with animated degradation. Damage is calculated per-planet and resets on travel.

### Planet Degradation (Earth example)

| Damage | Visual State |
|---|---|
| 0% | Pristine blue surface with cloud bands |
| 15% | Surface erosion — first craters appear |
| 30% | Moderate damage — cracks spread |
| 50% | Structural compromise — molten core bleeds through |
| 68% | Core exposure — orange glow dominates |
| 82% | Critical depletion — debris orbiting |
| 95%+ | Planet shell only |

### Resources

| Resource | Source |
|---|---|
| **Ore** | Clicking + Miner drones |
| **Credits** | Trader drones |
| **Research Points** | Researcher drones |

### Drones

| Drone | Produces | Base Cost |
|---|---|---|
| **Miner** | 0.5 ore/sec | 10 ore |
| **Researcher** | 0.1 RP/sec | 60 ore |
| **Trader** | 1.0 credit/sec | 50 ore |
| **Fabricator** | −5% all drone costs (stacks to 60%) | 150 ore + 80 cr + 10 RP |

All drone costs scale ×1.15–1.30 per purchase.

### Research Tree

9 upgrades across a dependency tree:

```
Reinforced Drill ──► Deep Seam Scanner ──► Crystal Seam ──► Dark Matter Trace
Drone Efficiency ──► Research Automation ─────────────────────────────────────┘
Market Access
Auto-Extractor
Overclocked Fabricators
```

**Dark Matter Trace** (250 RP + 500 cr) doubles all production — the endgame multiplier.

## Cloud Save & Leaderboard

On first visit you are prompted for a **commander name** (2–20 alphanumeric chars). Your save is stored by name on the API server, so:

- Resuming on a new device: enter the same name — save loads automatically.
- After clearing cookies/localStorage: enter the same name — save is restored from the cloud.
- The **Ranks** tab shows the top 20 commanders globally by total ore mined.

Local `localStorage` save still runs as a fallback even if the API is unreachable.

## Deploy

The stack runs two containers. Use the combined `docker-compose.yml` in the `extractor` repo:

```bash
docker compose up -d
```

| Service | Port | Image |
|---|---|---|
| extractor (frontend + nginx) | 3002 | `ghcr.io/atvriders/extractor:latest` |
| extractor-api (save/leaderboard) | internal | `ghcr.io/atvriders/extractor-api:latest` |

The frontend Nginx proxies `/api/` to the `extractor-api` container — no manual URL configuration needed.

Save data is persisted in a Docker named volume (`extractor-api-data`).

To update both images:

```bash
docker compose pull && docker compose up -d
```

## Build locally

```bash
# Frontend (extractor/)
npm install
npm run dev      # dev server on :5173
npm run build    # production build

# API (extractor-api/)
npm install
node index.js    # runs on :4000
```

For local dev, set `VITE_API_URL=http://localhost:4000` in a `.env` file in the extractor directory.

## CI

Pushes to `master` in each repo build and publish to GHCR:

```
ghcr.io/atvriders/extractor:latest
ghcr.io/atvriders/extractor-api:latest
```
