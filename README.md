# Extractor

A browser-based incremental clicker game. Click the planet to extract ore, build drones, and slowly industrialise the galaxy — all while watching the planet visually degrade beneath your mining operation.

![Docker](https://img.shields.io/badge/docker-ghcr.io-blue)

## Gameplay

Click the planet to earn ore. Spend ore on drones. Drones auto-produce resources every frame. Spend research points on upgrades that compound into massive production multipliers.

### Planet Degradation

The planet surface changes visually as you extract ore. Damage is calculated on a logarithmic scale so early progress is visible quickly.

| Damage | Visual State |
|---|---|
| 0% | Pristine blue surface with cloud bands |
| 15% | Surface erosion — first craters appear |
| 30% | Moderate damage — cracks begin spreading |
| 50% | Structural compromise — molten core bleeds through |
| 68% | Core exposure — orange glow dominates |
| 82% | Critical depletion — debris orbiting |
| 95%+ | Planet shell only |

Craters use seeded positions so they always appear in the same spots and grow consistently. Cracks emit a molten glow. At high damage, floating debris particles orbit the hollowed-out shell.

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
| **Researcher** | 0.1 RP/sec | 50 ore + 20 cr |
| **Trader** | 1.0 credit/sec | 30 ore + 30 cr |
| **Fabricator** | −5% all drone costs (stacks to 60%) | 100 ore + 100 cr + 10 RP |

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

## Run

```bash
docker compose up -d
```

Runs on **port 3002**. Requires the GHCR image to be available (built by CI on push to master).

To update:

```bash
docker compose pull && docker compose up -d
```

## Build locally

```bash
npm install
npm run dev     # dev server on :3002
npm run build   # production build
```

## CI

Pushes to `master` build and publish the Docker image to:

```
ghcr.io/atvriders/extractor:latest
```

Progress is saved automatically to `localStorage`.
