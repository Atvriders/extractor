import type { GameState } from './types';
import { getPlanet } from './planets';

export function computeStats(s: GameState) {
  const u   = s.upgrades;
  const has = (id: string) => u.includes(id);
  const sm  = s.stations ?? { mining: 0, research: 0, market: 0, fabricator: 0 };

  // ── Ore per click ──────────────────────────────────────────────────────────
  let orePerClick = 1;
  if (has('reinforced_drill'))    orePerClick *= 2;
  if (has('deep_seam'))           orePerClick *= 3;
  if (has('seismic_tap'))         orePerClick *= 2;

  // ── Miner rate ─────────────────────────────────────────────────────────────
  let minerRate = 0.5;
  if (has('drone_efficiency'))       minerRate *= 1.5;
  if (has('planetary_core_drill'))   minerRate *= 2;

  // ── Trader rate ────────────────────────────────────────────────────────────
  let traderRate = 1.0;
  if (has('market_access'))          traderRate *= 2;
  if (has('arbitrage_algorithm'))    traderRate *= 1.5;

  // ── Credit multiplier ──────────────────────────────────────────────────────
  let creditMult = 1;
  if (has('void_contracts'))         creditMult *= 2;

  // ── Researcher rate ────────────────────────────────────────────────────────
  let researcherRate = 0.1;
  if (has('research_automation'))    researcherRate *= 2;
  if (has('quantum_analysis'))       researcherRate *= 1.5;

  // ── Fabricator discount ────────────────────────────────────────────────────
  const fabPerUnit      = has('nano_assembly') ? 0.07 : 0.05;
  const baseCap         = has('neural_convergence') ? 0.90 : has('overclocked_fabricators') ? 0.80 : 0.60;
  const stationFabBonus = Math.min((sm.fabricator ?? 0) * 0.02, 0.10);
  const cap             = Math.min(baseCap + stationFabBonus, 0.95);
  const rawFab          = Number(s.drones.fabricator) || 0;
  const fabDiscount     = Math.min(rawFab * fabPerUnit, cap);

  // ── Global production multiplier ───────────────────────────────────────────
  let globalMult = 1;
  if (has('crystal_seam'))      globalMult *= 1.25;
  if (has('dark_matter_trace')) globalMult *= 2;
  if (has('dark_synthesis'))    globalMult *= 3;

  // ── Planet ore multiplier ──────────────────────────────────────────────────
  const planetMult = getPlanet(s.currentPlanet).oreMultiplier;

  // ── Station multipliers ────────────────────────────────────────────────────
  const stationOreMult    = 1 + (sm.mining    ?? 0) * 0.25;   // +25% ore/sec per mining station
  const stationRpFlat     =     (sm.research  ?? 0) * 0.5;    // +0.5 RP/sec flat per research station
  const stationCreditMult = 1 + (sm.market    ?? 0) * 0.15;   // +15% credits/sec per market station

  // ── Secondary drone bonuses ────────────────────────────────────────────────
  const minerClickBonus    = 1 + Math.min((s.drones.miner ?? 0) * 0.02, 0.50);
  const fabricatorOreMult  = 1 + Math.min(rawFab * 0.008, 0.15);
  const traderRpFlat       = (s.drones.trader ?? 0) * 0.02;
  const researchDiscount   = Math.min((s.drones.researcher ?? 0) * 0.01, 0.25);

  // ── Per-second totals ──────────────────────────────────────────────────────
  const autoRate  = has('auto_extractor') ? 2 : 0;
  const orePerSec =
    ((s.drones.miner * minerRate * globalMult) + autoRate) * planetMult * stationOreMult * fabricatorOreMult;

  const creditsPerSec =
    s.drones.trader * traderRate * globalMult * creditMult * stationCreditMult;

  const rpPerSec =
    s.drones.researcher * researcherRate + stationRpFlat + traderRpFlat;

  return {
    orePerClick: orePerClick * planetMult * minerClickBonus,
    orePerSec, creditsPerSec, rpPerSec,
    fabDiscount, globalMult, planetMult,
    stationOreMult, stationCreditMult, stationRpFlat,
    researchDiscount, minerClickBonus,
  };
}

// ── Drone costs ────────────────────────────────────────────────────────────
const DRONE_BASE: Record<string, { ore: number; credits: number; rp: number; scale: number }> = {
  miner:      { ore: 10,  credits: 0,  rp: 0,  scale: 1.15 },
  researcher: { ore: 60,  credits: 0,  rp: 0,  scale: 1.20 },
  trader:     { ore: 50,  credits: 0,  rp: 0,  scale: 1.20 },
  fabricator: { ore: 150, credits: 80, rp: 10, scale: 1.30 },
};

export function droneCost(drone: string, count: number, fabDiscount: number) {
  const b    = DRONE_BASE[drone];
  const mult = Math.pow(b.scale, count) * (1 - fabDiscount);
  return {
    ore:     Math.ceil(b.ore     * mult),
    credits: Math.ceil(b.credits * mult),
    rp:      Math.ceil(b.rp      * mult),
  };
}

// ── Station costs ──────────────────────────────────────────────────────────
const STATION_BASE: Record<string, { ore: number; credits: number; scale: number }> = {
  mining:     { ore: 5_000,  credits: 2_000,  scale: 1.50 },
  research:   { ore: 8_000,  credits: 4_000,  scale: 1.60 },
  market:     { ore: 6_000,  credits: 3_000,  scale: 1.55 },
  fabricator: { ore: 12_000, credits: 8_000,  scale: 1.70 },
};

export function stationCost(type: string, count: number) {
  const b    = STATION_BASE[type];
  const mult = Math.pow(b.scale, count);
  return {
    ore:     Math.ceil(b.ore     * mult),
    credits: Math.ceil(b.credits * mult),
  };
}
