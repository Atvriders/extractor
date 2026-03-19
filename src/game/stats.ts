import type { GameState } from './types';
import { getPlanet } from './planets';

export function computeStats(s: GameState) {
  const u = s.upgrades;
  const has = (id: string) => u.includes(id);

  let orePerClick = 1;
  if (has('reinforced_drill')) orePerClick *= 2;
  if (has('deep_seam'))        orePerClick *= 3;

  let minerRate = 0.5;
  if (has('drone_efficiency')) minerRate *= 1.5;

  let traderRate = 1.0;
  if (has('market_access')) traderRate *= 2;

  let researcherRate = 0.1;
  if (has('research_automation')) researcherRate *= 2;

  const cap = has('overclocked_fabricators') ? 0.80 : 0.60;
  const rawFab = Number(s.drones.fabricator) || 0;
  const fabDiscount = Math.min(rawFab * 0.05, cap);

  let globalMult = 1;
  if (has('crystal_seam'))      globalMult *= 1.25;
  if (has('dark_matter_trace')) globalMult *= 2;

  // Planet ore multiplier
  const planetMult = getPlanet(s.currentPlanet).oreMultiplier;

  const orePerSec =
    (s.drones.miner * minerRate * globalMult + (has('auto_extractor') ? 2 : 0)) * planetMult;

  const creditsPerSec = s.drones.trader    * traderRate    * globalMult;
  const rpPerSec      = s.drones.researcher * researcherRate;

  return {
    orePerClick:  orePerClick * planetMult,
    orePerSec, creditsPerSec, rpPerSec,
    fabDiscount, globalMult, planetMult,
  };
}

// ── Drone costs ────────────────────────────────────────────────────────────
// Trader costs 0 credits initially — you need credits to buy a Trader
// (removing the catch-22 where Trader needs credits but credits come from Traders)
const BASE: Record<string, { ore: number; credits: number; rp: number; scale: number }> = {
  miner:      { ore: 10,  credits: 0,  rp: 0,  scale: 1.15 },
  researcher: { ore: 60,  credits: 0,  rp: 0,  scale: 1.20 },
  trader:     { ore: 50,  credits: 0,  rp: 0,  scale: 1.20 },
  fabricator: { ore: 150, credits: 80, rp: 10, scale: 1.30 },
};

export function droneCost(drone: string, count: number, fabDiscount: number) {
  const b    = BASE[drone];
  const mult = Math.pow(b.scale, count) * (1 - fabDiscount);
  return {
    ore:     Math.ceil(b.ore     * mult),
    credits: Math.ceil(b.credits * mult),
    rp:      Math.ceil(b.rp      * mult),
  };
}
