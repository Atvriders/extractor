import type { GameState } from './types';
import { INITIAL_STATE } from './reducer';

const KEY = 'extractor_save';

export function saveGame(state: GameState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

export function loadGame(): GameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return INITIAL_STATE;
    const parsed = JSON.parse(raw) as Partial<GameState>;
    return {
      ...INITIAL_STATE,
      ...parsed,
      // Deep-merge drones so missing keys (old saves) default to 0 instead of undefined
      drones: { ...INITIAL_STATE.drones, ...(parsed.drones ?? {}) },
    };
  } catch {
    return INITIAL_STATE;
  }
}

export function resetGame() {
  localStorage.removeItem(KEY);
}
