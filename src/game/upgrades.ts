import type { GameState } from './types';

export interface Upgrade {
  id: string;
  name: string;
  desc: string;
  rpCost: number;
  creditCost?: number;
  requires?: string[];
  unlockHint?: string; // shown when locked
}

export const UPGRADES: Upgrade[] = [
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
    rpCost: 20,
    creditCost: 50,
  },
  {
    id: 'auto_extractor',
    name: 'Auto-Extractor',
    desc: 'Gain 2 free ore per second passively.',
    rpCost: 30,
  },
  {
    id: 'deep_seam',
    name: 'Deep Seam Scanner',
    desc: 'Ore per click ×3 (stacks with Reinforced Drill).',
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
    id: 'overclocked_fabricators',
    name: 'Overclocked Fabricators',
    desc: 'Fabricators reduce drone costs further (cap raised to 80%).',
    rpCost: 60,
  },
  {
    id: 'crystal_seam',
    name: 'Crystal Seam',
    desc: 'Unlocks Crystal extraction — all income +25%.',
    rpCost: 100,
    requires: ['deep_seam'],
  },
  {
    id: 'dark_matter_trace',
    name: 'Dark Matter Trace',
    desc: 'All production ×2. (Unlocks next planet tier.)',
    rpCost: 250,
    creditCost: 500,
    requires: ['crystal_seam', 'research_automation'],
  },
];

export function isUnlocked(upg: Upgrade, purchased: string[]): boolean {
  if (!upg.requires) return true;
  return upg.requires.every(r => purchased.includes(r));
}

export function canAfford(upg: Upgrade, state: GameState): boolean {
  return state.rp >= upg.rpCost && (state.credits >= (upg.creditCost ?? 0));
}
