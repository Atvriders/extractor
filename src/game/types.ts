export type DroneType = 'miner' | 'researcher' | 'trader' | 'fabricator';

export interface GameState {
  ore: number;
  credits: number;
  rp: number;            // research points
  drones: Record<DroneType, number>;
  upgrades: string[];    // purchased upgrade ids
  totalClicks: number;
  totalOreExtracted: number;
  tab: 'drones' | 'research';
  notification: string;
}

export type Action =
  | { type: 'TICK'; delta: number }
  | { type: 'CLICK' }
  | { type: 'BUY_DRONE'; drone: DroneType }
  | { type: 'BUY_UPGRADE'; id: string }
  | { type: 'SET_TAB'; tab: GameState['tab'] }
  | { type: 'LOAD'; state: GameState };
