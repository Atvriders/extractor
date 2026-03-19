import type { GameState, Action, DroneType } from './types';
import { computeStats, droneCost } from './stats';
import { UPGRADES, isUnlocked, canAfford } from './upgrades';

export const INITIAL_STATE: GameState = {
  ore: 0,
  credits: 0,
  rp: 0,
  drones: { miner: 0, researcher: 0, trader: 0, fabricator: 0 },
  upgrades: [],
  totalClicks: 0,
  totalOreExtracted: 0,
  tab: 'drones',
  notification: '',
};

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {

    case 'TICK': {
      const { orePerSec, creditsPerSec, rpPerSec } = computeStats(state);
      const dt = action.delta / 1000;
      const oreGain = orePerSec * dt;
      return {
        ...state,
        ore:                 state.ore + oreGain,
        credits:             state.credits + creditsPerSec * dt,
        rp:                  state.rp + rpPerSec * dt,
        totalOreExtracted:   state.totalOreExtracted + oreGain,
      };
    }

    case 'CLICK': {
      const { orePerClick } = computeStats(state);
      return {
        ...state,
        ore:               state.ore + orePerClick,
        totalClicks:       state.totalClicks + 1,
        totalOreExtracted: state.totalOreExtracted + orePerClick,
      };
    }

    case 'BUY_DRONE': {
      const { fabDiscount } = computeStats(state);
      const drone = action.drone as DroneType;
      const cost = droneCost(drone, state.drones[drone], fabDiscount);
      if (state.ore < cost.ore || state.credits < cost.credits || state.rp < cost.rp) {
        return state;
      }
      return {
        ...state,
        ore:     state.ore     - cost.ore,
        credits: state.credits - cost.credits,
        rp:      state.rp      - cost.rp,
        drones:  { ...state.drones, [drone]: state.drones[drone] + 1 },
      };
    }

    case 'BUY_UPGRADE': {
      const upg = UPGRADES.find(u => u.id === action.id);
      if (!upg) return state;
      if (state.upgrades.includes(action.id)) return state;
      if (!isUnlocked(upg, state.upgrades)) return state;
      if (!canAfford(upg, state)) return state;
      return {
        ...state,
        rp:       state.rp      - upg.rpCost,
        credits:  state.credits - (upg.creditCost ?? 0),
        upgrades: [...state.upgrades, action.id],
        notification: `Researched: ${upg.name}`,
      };
    }

    case 'SET_TAB':
      return { ...state, tab: action.tab };

    case 'LOAD':
      return action.state;

    default:
      return state;
  }
}
