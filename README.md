# Extractor

A browser-based incremental clicker game. Click the planet to extract ore, build drones, deploy space stations, and industrialise the galaxy. Watch your fleet of visually distinct drones fly between the planet and your orbiting spaceship in real time, while the planet degrades beneath your operation. Fully mobile-friendly with cloud save and a cross-device leaderboard.

![Docker](https://img.shields.io/badge/docker-ghcr.io-blue)

## Gameplay

Click the planet to earn ore. Spend ore on drones. Drones auto-produce resources every frame. Build stations to multiply output. Spend research points on upgrades that compound into massive production multipliers. When a planet is sufficiently exhausted, travel to the next one for higher yields.

### Planets

| Planet | Unlock | Yield | Damage Threshold |
|---|---|---|---|
| **Earth** | Start | 1× | 5,000 ore |
| **Kaelthar** | 3,000 total ore | 2.5× | 30,000 ore |
| **Cryovast** | 25,000 total ore | 7× | 200,000 ore |
| **Nullspire** | 200,000 total ore | 20× | 2,000,000 ore |

Each planet has a unique canvas-rendered 3D surface with animated degradation and a hemisphere shadow overlay. Planet canvas is 420×420 px on desktop. Damage is calculated per-planet and resets on travel. All planets are rendered on a starfield canvas with twinkling stars.

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
| **Ore** | Clicking + Miner drones + Mining Stations |
| **Credits** | Trader drones + Market Stations |
| **Research Points** | Researcher drones + Research Stations |

### Drones

| Drone | Produces | Base Cost | Visual |
|---|---|---|---|
| **Miner** | 0.5 ore/sec | 10 ore | Orange chunky hull with front drill bit |
| **Researcher** | 0.1 RP/sec | 60 ore | Slim purple craft with rotating sensor dish |
| **Trader** | 1.0 credit/sec | 50 ore | Gold boxy hauler with top/bottom cargo pods |
| **Fabricator** | −5% all drone costs (stacks to 60%) | 150 ore + 80 cr + 10 RP | Teal hexagonal drone with animated robotic arm |

All drone costs scale ×1.15–1.30 per purchase.

Drones are animated on the canvas — up to 2 of each type fly bezier-curve paths between the planet surface and the player's spaceship simultaneously. Colour brightens on the return trip (loaded). The player's spaceship is visible in the top-right corner with engine exhaust, blinking nav lights, and a docking bay light strip.

### Stations

Stations are permanent orbital installations that amplify production. Built from the **Stations** tab; each costs ore + credits and scales in price with count.

| Station | Bonus per unit | Base Cost |
|---|---|---|
| **Mining Station** | +25% ore production | 5,000 ore + 2,000 cr |
| **Research Station** | +0.5 RP/sec flat | 8,000 ore + 4,000 cr |
| **Market Station** | +15% credit production | 6,000 ore + 3,000 cr |
| **Fabricator Station** | +2% drone-cost cap reduction (max +10%) | 12,000 ore + 8,000 cr |

Stations are rendered on the canvas as animated orbital structures at type-specific orbit radii around the planet (Mining closest, Research outermost). Up to 3 of each type are shown, evenly spaced angularly, with faint orbit rings.

### Research Tree

17 upgrades across a 5-tier dependency tree:

```
Tier 1 (no prereqs)
  Reinforced Drill      — click ore ×2
  Drone Efficiency      — miner output ×1.5
  Market Access         — trader output ×1.5
  Auto-Extractor        — passive +1 ore/sec
  Overclocked Fabricators — raise fab discount cap 60%→80%

Tier 2
  Deep Seam Scanner     — req: Reinforced Drill      — miner ×2 + click ore ×2
  Research Automation   — req: Drone Efficiency      — researcher ×1.5
  Arbitrage Algorithm   — req: Market Access         — trader ×1.5 more
  Nano Assembly         — req: Overclocked Fab       — fab per-unit rate 0.05→0.07

Tier 3
  Crystal Seam          — req: Deep Seam Scanner     — miner ×2, click ×3
  Quantum Analysis      — req: Research Automation   — researcher ×1.5 RP
  Void Contracts        — req: Arbitrage Algorithm   — all credits ×2
  Neural Convergence    — req: Quantum Analysis      — fab cap 80%→90%

Tier 4
  Dark Matter Trace     — req: Crystal Seam + Research Automation — all prod ×2
  Seismic Tap           — req: Crystal Seam          — click ore ×2
  Planetary Core Drill  — req: Seismic Tap            — miners ×2

Tier 5
  Dark Synthesis        — req: Dark Matter Trace + Nano Assembly — all prod ×3
```

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
