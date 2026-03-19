import type { GameState } from './types';

export interface Upgrade {
  id:          string;
  name:        string;
  desc:        string;
  rpCost:      number;
  creditCost?: number;
  requires?:   string[];
}

export const UPGRADES: Upgrade[] = [
  // ── Tier 1: available from the start ──────────────────────────────────────
  {
    id: 'reinforced_drill',
    name: 'Reinforced Drill',
    desc: 'Double ore per click.',
    rpCost: 5,
  },
  {
    id: 'drone_efficiency',
    name: 'Drone Efficiency',
    desc: 'Miners produce 50% more ore.',
    rpCost: 15,
  },
  {
    id: 'market_access',
    name: 'Market Access',
    desc: 'Traders earn 2× credits.',
    rpCost: 20, creditCost: 50,
  },
  {
    id: 'auto_extractor',
    name: 'Auto-Extractor',
    desc: 'Gain 2 free ore/sec passively.',
    rpCost: 30,
  },
  {
    id: 'overclocked_fabricators',
    name: 'Overclocked Fabricators',
    desc: 'Fabricators cut drone costs further (cap raised to 80%).',
    rpCost: 60,
  },

  // ── Tier 2: require one Tier-1 unlock ─────────────────────────────────────
  {
    id: 'deep_seam',
    name: 'Deep Seam Scanner',
    desc: 'Ore per click ×3 (stacks with Reinforced Drill → ×6 total).',
    rpCost: 50,
    requires: ['reinforced_drill'],
  },
  {
    id: 'research_automation',
    name: 'Research Automation',
    desc: 'Researchers produce 2× RP.',
    rpCost: 40,
    requires: ['drone_efficiency'],
  },
  {
    id: 'arbitrage_algorithm',
    name: 'Arbitrage Algorithm',
    desc: 'Traders earn an additional 1.5× credits (stacks with Market Access → 3× total).',
    rpCost: 60, creditCost: 100,
    requires: ['market_access'],
  },
  {
    id: 'nano_assembly',
    name: 'Nano-Assembly',
    desc: 'Each Fabricator drone gives 40% more discount per unit.',
    rpCost: 100,
    requires: ['overclocked_fabricators'],
  },

  // ── Tier 3: require two or more Tier-2 unlocks ────────────────────────────
  {
    id: 'crystal_seam',
    name: 'Crystal Seam',
    desc: 'Unlocks Crystal extraction — all income +25%.',
    rpCost: 100,
    requires: ['deep_seam'],
  },
  {
    id: 'quantum_analysis',
    name: 'Quantum Analysis',
    desc: 'Researchers produce an additional 1.5× RP (stacks → 3× total).',
    rpCost: 80,
    requires: ['research_automation'],
  },
  {
    id: 'void_contracts',
    name: 'Void Contracts',
    desc: 'Galactic trade route unlocked — all credits income ×2.',
    rpCost: 150, creditCost: 400,
    requires: ['arbitrage_algorithm'],
  },
  {
    id: 'neural_convergence',
    name: 'Neural Convergence',
    desc: 'AI optimisation raises Fabricator discount cap to 90%.',
    rpCost: 200, creditCost: 200,
    requires: ['quantum_analysis'],
  },

  // ── Tier 4: late-game ─────────────────────────────────────────────────────
  {
    id: 'dark_matter_trace',
    name: 'Dark Matter Trace',
    desc: 'All production ×2.',
    rpCost: 250, creditCost: 500,
    requires: ['crystal_seam', 'research_automation'],
  },
  {
    id: 'seismic_tap',
    name: 'Seismic Tap',
    desc: 'Resonance drilling — ore per click ×2 more (stacks with all prior drills).',
    rpCost: 120,
    requires: ['crystal_seam'],
  },
  {
    id: 'planetary_core_drill',
    name: 'Planetary Core Drill',
    desc: 'Breach the molten core — Miners produce 2× more ore.',
    rpCost: 200, creditCost: 300,
    requires: ['seismic_tap'],
  },

  // ── Tier 5: endgame ───────────────────────────────────────────────────────
  {
    id: 'dark_synthesis',
    name: 'Dark Synthesis',
    desc: 'Harness dark matter as fuel — all production ×3 (stacks with Dark Matter Trace → ×6 total).',
    rpCost: 400, creditCost: 1000,
    requires: ['dark_matter_trace', 'nano_assembly'],
  },
];

export function isUnlocked(upg: Upgrade, purchased: string[]): boolean {
  if (!upg.requires) return true;
  return upg.requires.every(r => purchased.includes(r));
}

export function canAfford(upg: Upgrade, state: GameState): boolean {
  return state.rp >= upg.rpCost && (state.credits >= (upg.creditCost ?? 0));
}
