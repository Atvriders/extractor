import { useReducer, useEffect, useRef, useCallback } from 'react';
import Planet from './components/Planet';
import ResourceBar from './components/ResourceBar';
import DronePanel from './components/DronePanel';
import ResearchPanel from './components/ResearchPanel';
import { reducer } from './game/reducer';
import { loadGame, saveGame, resetGame } from './game/save';
import type { DroneType } from './game/types';
import './App.css';

const TICK_MS = 100;
const SAVE_EVERY = 50; // ticks

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, loadGame);
  const tickCount = useRef(0);

  // Game loop
  useEffect(() => {
    let last = performance.now();
    let raf = 0;

    function loop(now: number) {
      const delta = now - last;
      last = now;
      if (delta > 0 && delta < 5000) {
        dispatch({ type: 'TICK', delta });
        tickCount.current++;
        if (tickCount.current % SAVE_EVERY === 0) {
          saveGame(state);
        }
      }
      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save on state change (throttled via tickCount)
  useEffect(() => {
    saveGame(state);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.upgrades, state.drones]);

  const handleClick    = useCallback(() => dispatch({ type: 'CLICK' }),             []);
  const handleBuyDrone = useCallback((d: DroneType) => dispatch({ type: 'BUY_DRONE', drone: d }), []);
  const handleBuyUpg   = useCallback((id: string)   => dispatch({ type: 'BUY_UPGRADE', id }),     []);
  const handleReset    = useCallback(() => { resetGame(); window.location.reload(); },              []);

  const totalDrones = Object.values(state.drones).reduce((a, b) => a + b, 0);

  return (
    <div className="app">
      <header className="topbar">
        <span className="game-title">⬡ EXTRACTOR</span>
        <span className="drone-total">Drones active: {totalDrones}</span>
        <button className="reset-btn" onClick={handleReset}>Reset</button>
      </header>

      <ResourceBar state={state} />

      <div className="main-layout">
        {/* Left: Planet */}
        <div className="left-col">
          <Planet state={state} onClickPlanet={handleClick} />
          <div className="stats-box">
            <div className="stat-row">Total clicks: {state.totalClicks.toLocaleString()}</div>
            <div className="stat-row">Total ore mined: {Math.floor(state.totalOreExtracted).toLocaleString()}</div>
          </div>
        </div>

        {/* Right: Tabs */}
        <div className="right-col">
          <div className="tabs">
            <button
              className={`tab-btn${state.tab === 'drones' ? ' active' : ''}`}
              onClick={() => dispatch({ type: 'SET_TAB', tab: 'drones' })}
            >
              🤖 Drones
            </button>
            <button
              className={`tab-btn${state.tab === 'research' ? ' active' : ''}`}
              onClick={() => dispatch({ type: 'SET_TAB', tab: 'research' })}
            >
              🔬 Research
            </button>
          </div>

          {state.tab === 'drones'
            ? <DronePanel   state={state} onBuy={handleBuyDrone} />
            : <ResearchPanel state={state} onBuy={handleBuyUpg} />
          }
        </div>
      </div>

      {state.notification && (
        <div className="notification">{state.notification}</div>
      )}
    </div>
  );
}
