export type DroneType   = 'miner' | 'researcher' | 'trader' | 'fabricator';
export type StationType = 'mining' | 'research' | 'market' | 'fabricator';

export interface GameState {
  ore: number;
  credits: number;
  rp: number;
  drones:   Record<DroneType,   number>;
  stations: Record<StationType, number>;
  upgrades: string[];
  totalClicks: number;
  totalOreExtracted: number;
  planetOreExtracted: number; // resets on planet switch — drives damage
  currentPlanet: number;      // 0=Earth 1=Kaelthar 2=Cryovast 3=Nullspire
  tab: 'drones' | 'research' | 'stations' | 'planets' | 'leaderboard';
  notification: string;
  notifKey: number;           // changes to re-trigger notification animation
}

export type Action =
  | { type: 'TICK';        delta: number }
  | { type: 'CLICK' }
  | { type: 'BUY_DRONE';   drone:   DroneType }
  | { type: 'BUY_STATION'; station: StationType }
  | { type: 'BUY_UPGRADE'; id: string }
  | { type: 'SET_TAB';     tab: GameState['tab'] }
  | { type: 'NEXT_PLANET' }
  | { type: 'LOAD';        state: GameState };
