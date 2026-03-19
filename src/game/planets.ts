export interface PlanetConfig {
  id:              number;
  name:            string;
  description:     string;
  unlockTotalOre:  number;  // total ore ever mined to unlock
  oreMultiplier:   number;  // applied to all ore production
  damageThreshold: number;  // planetOreExtracted needed to exhaust planet
}

export const PLANETS: PlanetConfig[] = [
  {
    id: 0, name: 'Earth',
    description: 'Your home world. Fragile oceans and ancient forests hide rich surface ore.',
    unlockTotalOre: 0, oreMultiplier: 1, damageThreshold: 5_000,
  },
  {
    id: 1, name: 'Kaelthar',
    description: 'A scorched iron-red world. Pressurised ore veins run kilometres deep beneath the dust.',
    unlockTotalOre: 3_000, oreMultiplier: 2.5, damageThreshold: 30_000,
  },
  {
    id: 2, name: 'Cryovast',
    description: 'A tidally-locked glacial giant. Crystal lattice deposits glow beneath kilometres of ancient ice.',
    unlockTotalOre: 25_000, oreMultiplier: 7, damageThreshold: 200_000,
  },
  {
    id: 3, name: 'Nullspire',
    description: 'A rogue mass adrift between galaxies. Physics here is negotiable. Ore density is not.',
    unlockTotalOre: 200_000, oreMultiplier: 20, damageThreshold: 2_000_000,
  },
];

export function getPlanet(id: number): PlanetConfig {
  return PLANETS[Math.min(id, PLANETS.length - 1)];
}

export function calcDamage(planetOreExtracted: number, planet: PlanetConfig): number {
  return Math.min(1, planetOreExtracted / planet.damageThreshold);
}
