import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import Planet           from './components/Planet';
import ResourceBar      from './components/ResourceBar';
import DronePanel       from './components/DronePanel';
import ResearchPanel    from './components/ResearchPanel';
import PlanetsPanel     from './components/PlanetsPanel';
import LeaderboardPanel from './components/LeaderboardPanel';
import UsernameModal    from './components/UsernameModal';
import { reducer }      from './game/reducer';
import { loadGame, saveGame, resetGame } from './game/save';
import { getPlanet, calcDamage, PLANETS } from './game/planets';
import { apiLoad, apiSave } from './api';
import type { DroneType } from './game/types';
import './App.css';

const USERNAME_KEY = 'extractor_username';

export default function App() {
  const [username, setUsername]     = useState<string | null>(() => localStorage.getItem(USERNAME_KEY));
  const [apiReady, setApiReady]     = useState(false);
  const [state, dispatch]           = useReducer(reducer, undefined, loadGame);
  const [notifVisible, setNotif]    = useState(false);
  const notifTimer                  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudSaveTimer              = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Username confirm: load cloud save, then start ──────────────────────────
  async function handleUsername(name: string) {
    localStorage.setItem(USERNAME_KEY, name);
    const cloud = await apiLoad(name);
    if (cloud) {
      dispatch({ type: 'LOAD', state: cloud as Parameters<typeof reducer>[0] });
    }
    setUsername(name);
    setApiReady(true);
  }

  // On mount: if username already stored, do cloud load silently
  useEffect(() => {
    if (!username) return;
    apiLoad(username).then(cloud => {
      if (cloud) dispatch({ type: 'LOAD', state: cloud as Parameters<typeof reducer>[0] });
      setApiReady(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Game loop at 60fps ─────────────────────────────────────────────────────
  useEffect(() => {
    let last = performance.now();
    let raf  = 0;
    function loop(now: number) {
      const delta = now - last;
      last = now;
      if (delta > 0 && delta < 5000) dispatch({ type: 'TICK', delta });
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Local save on meaningful changes ──────────────────────────────────────
  useEffect(() => { saveGame(state); }, [state.upgrades, state.drones, state.currentPlanet]);

  // ── Cloud save (debounced 10s) on state changes ────────────────────────────
  useEffect(() => {
    if (!username || !apiReady) return;
    if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current);
    cloudSaveTimer.current = setTimeout(() => {
      saveGame(state);
      apiSave(username, state);
    }, 10_000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.totalOreExtracted, state.upgrades, state.drones, state.currentPlanet]);

  // ── Periodic local save every 30s ─────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => saveGame(state), 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Notification ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!state.notification) return;
    setNotif(true);
    if (notifTimer.current) clearTimeout(notifTimer.current);
    notifTimer.current = setTimeout(() => setNotif(false), 3000);
  }, [state.notifKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick      = useCallback(() => dispatch({ type: 'CLICK' }), []);
  const handleBuyDrone   = useCallback((d: DroneType) => dispatch({ type: 'BUY_DRONE', drone: d }), []);
  const handleBuyUpg     = useCallback((id: string) => dispatch({ type: 'BUY_UPGRADE', id }), []);
  const handleNextPlanet = useCallback(() => dispatch({ type: 'NEXT_PLANET' }), []);
  const handleReset      = useCallback(() => { resetGame(); window.location.reload(); }, []);

  const totalDrones = Object.values(state.drones).reduce((a, b) => a + b, 0);
  const planet      = getPlanet(state.currentPlanet);
  const _damage     = calcDamage(state.planetOreExtracted, planet);

  const nextPlanet = PLANETS[state.currentPlanet + 1];
  const canAdvance = nextPlanet && state.totalOreExtracted >= nextPlanet.unlockTotalOre;

  // Show username modal if not set
  if (!username) {
    return <UsernameModal onConfirm={handleUsername} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <span className="game-title">⬡ EXTRACTOR</span>
        <span className="drone-total">
          {username && <span className="topbar-user">👤 {username} · </span>}
          Drones: {totalDrones} · {planet.name}
        </span>
        <button className="reset-btn" onClick={handleReset}>Reset</button>
      </header>

      <ResourceBar state={state} />

      <div className="main-layout">
        <div className="left-col">
          <Planet state={state} onClickPlanet={handleClick} />
          {canAdvance && (
            <button className="advance-btn" onClick={handleNextPlanet}>
              → Advance to {nextPlanet.name}
            </button>
          )}
          <div className="stats-box">
            <div className="stat-row">Total clicks: {state.totalClicks.toLocaleString()}</div>
            <div className="stat-row">Total ore mined: {Math.floor(state.totalOreExtracted).toLocaleString()}</div>
          </div>
        </div>

        <div className="right-col">
          <div className="tabs">
            <button className={`tab-btn${state.tab === 'drones'      ? ' active' : ''}`} onClick={() => dispatch({ type: 'SET_TAB', tab: 'drones' })}>🤖 Drones</button>
            <button className={`tab-btn${state.tab === 'research'    ? ' active' : ''}`} onClick={() => dispatch({ type: 'SET_TAB', tab: 'research' })}>🔬 Research</button>
            <button className={`tab-btn${state.tab === 'planets'     ? ' active' : ''}`} onClick={() => dispatch({ type: 'SET_TAB', tab: 'planets' })}>🪐 Planets</button>
            <button className={`tab-btn${state.tab === 'leaderboard' ? ' active' : ''}`} onClick={() => dispatch({ type: 'SET_TAB', tab: 'leaderboard' })}>🏆 Ranks</button>
          </div>

          {state.tab === 'drones'      && <DronePanel       state={state} onBuy={handleBuyDrone} />}
          {state.tab === 'research'    && <ResearchPanel    state={state} onBuy={handleBuyUpg} />}
          {state.tab === 'planets'     && <PlanetsPanel     state={state} onNext={handleNextPlanet} />}
          {state.tab === 'leaderboard' && <LeaderboardPanel currentUsername={username} totalOre={state.totalOreExtracted} />}
        </div>
      </div>

      {notifVisible && state.notification && (
        <div className="notification" key={state.notifKey}>{state.notification}</div>
      )}
    </div>
  );
}
