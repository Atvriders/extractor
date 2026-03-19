import type { GameState } from '../game/types';
import { PLANETS, calcDamage, getPlanet } from '../game/planets';

interface Props { state: GameState; onNext: () => void }

function fmt(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toString();
}

const PLANET_ICONS = ['🌍', '🔴', '🧊', '🌑'];

export default function PlanetsPanel({ state, onNext }: Props) {
  const current = state.currentPlanet;

  return (
    <div className="panel">
      <h2 className="panel-title">Planets</h2>
      <div className="planet-list">
        {PLANETS.map((p, i) => {
          const isCurrent  = i === current;
          const isUnlocked = state.totalOreExtracted >= p.unlockTotalOre;
          const isPast     = i < current;
          const damage     = isCurrent ? calcDamage(state.planetOreExtracted, p) : isPast ? 1 : 0;
          const currentPlanet = PLANETS[current];
          const currentExhausted = state.planetOreExtracted >= currentPlanet.damageThreshold;
          const canAdvance = i === current + 1 && currentExhausted;

          return (
            <div key={p.id} className={`planet-card ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''} ${!isUnlocked && !isPast && !isCurrent ? 'locked' : ''}`}>
              <div className="planet-card-icon">{isUnlocked || isCurrent ? PLANET_ICONS[i] : '🔒'}</div>
              <div className="planet-card-info">
                <div className="planet-card-name">
                  {p.name}
                  {isCurrent && <span className="current-badge">CURRENT</span>}
                  {isPast    && <span className="past-badge">EXHAUSTED</span>}
                </div>
                <div className="planet-card-desc">{isUnlocked || isCurrent ? p.description : `Unlock at ${fmt(p.unlockTotalOre)} total ore`}</div>
                {(isUnlocked || isCurrent) && (
                  <div className="planet-card-stats">
                    <span className="pstat">⛏ {p.oreMultiplier}× yield</span>
                    {isCurrent && <span className="pstat">📊 {Math.round(damage * 100)}% depleted</span>}
                  </div>
                )}
              </div>
              {canAdvance && (
                <button className="buy-btn planet-advance-btn" onClick={onNext}>
                  Travel →
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
