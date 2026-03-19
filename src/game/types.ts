export type DroneType = 'miner' | 'researcher' | 'trader' | 'fabricator';

export interface GameState {
  ore: number;
  credits: number;
  rp: number;
  drones: Record<DroneType, number>;
  upgrades: string[];
  totalClicks: number;
  totalOreExtracted: number;
  planetOreExtracted: number; // resets on planet switch — drives damage
  currentPlanet: number;      // 0=Earth 1=Arid 2=Frozen 3=Void
  tab: 'drones' | 'research' | 'planets' | 'leaderboard';
  notification: string;
  notifKey: number;           // changes to re-trigger notification animation
}

export type Action =
  | { type: 'TICK'; delta: number }
  | { type: 'CLICK' }
  | { type: 'BUY_DRONE'; drone: DroneType }
  | { type: 'BUY_UPGRADE'; id: string }
  | { type: 'SET_TAB'; tab: GameState['tab'] }
  | { type: 'NEXT_PLANET' }
  | { type: 'LOAD'; state: GameState };
