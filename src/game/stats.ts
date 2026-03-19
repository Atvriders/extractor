import type { GameState } from './types';

/** Compute all derived stats from current state */
export function computeStats(s: GameState) {
  const u = s.upgrades;
  const has = (id: string) => u.includes(id);

  // Click power
  let orePerClick = 1;
  if (has('reinforced_drill')) orePerClick *= 2;
  if (has('deep_seam'))        orePerClick *= 3;

  // Miner production (ore/sec)
  let minerRate = 0.5;
  if (has('drone_efficiency')) minerRate *= 1.5;

  // Trader production (credits/sec)
  let traderRate = 1.0;
  if (has('market_access')) traderRate *= 2;

  // Researcher production (rp/sec)
  let researcherRate = 0.1;
  if (has('research_automation')) researcherRate *= 2;

  // Fabricator discount (stacking, cap 60% normally, 80% if overclocked)
  const cap = has('overclocked_fabricators') ? 0.80 : 0.60;
  const fabDiscount = Math.min(s.drones.fabricator * 0.05, cap);

  // Global multiplier from crystal_seam / dark_matter_trace
  let globalMult = 1;
  if (has('crystal_seam'))     globalMult *= 1.25;
  if (has('dark_matter_trace')) globalMult *= 2;

  const orePerSec =
    s.drones.miner * minerRate * globalMult +
    (has('auto_extractor') ? 2 : 0);

  const creditsPerSec = s.drones.trader * traderRate * globalMult;
  const rpPerSec      = s.drones.researcher * researcherRate;

  return { orePerClick, orePerSec, creditsPerSec, rpPerSec, fabDiscount, globalMult };
}

/** Cost of next drone (scales with count) */
const BASE: Record<string, { ore: number; credits: number; rp: number; scale: number }> = {
  miner:      { ore: 10,  credits: 0,   rp: 0,  scale: 1.15 },
  researcher: { ore: 50,  credits: 20,  rp: 0,  scale: 1.20 },
  trader:     { ore: 30,  credits: 30,  rp: 0,  scale: 1.20 },
  fabricator: { ore: 100, credits: 100, rp: 10, scale: 1.30 },
};

export function droneCost(drone: string, count: number, fabDiscount: number) {
  const b = BASE[drone];
  const mult = Math.pow(b.scale, count) * (1 - fabDiscount);
  return {
    ore:     Math.ceil(b.ore     * mult),
    credits: Math.ceil(b.credits * mult),
    rp:      Math.ceil(b.rp      * mult),
  };
}
