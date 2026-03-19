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
  const currentPlanetCfg = getPlanet(current);
  const currentExhausted = state.planetOreExtracted >= currentPlanetCfg.damageThreshold;

  return (
    <div className="panel">
      <h2 className="panel-title">Planets</h2>
      <div className="planet-list">
        {PLANETS.map((p, i) => {
          const isCurrent = i === current;
          const isPast    = i < current;
          const isNext    = i === current + 1;
          const isLocked  = i > current + 1;
          const damage    = isCurrent ? calcDamage(state.planetOreExtracted, p) : isPast ? 1 : 0;

          return (
            <div key={p.id} className={`planet-card ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''} ${isLocked ? 'locked' : ''}`}>
              <div className="planet-card-icon">{isLocked ? '🔒' : PLANET_ICONS[i]}</div>
              <div className="planet-card-info">
                <div className="planet-card-name">
                  {p.name}
                  {isCurrent && <span className="current-badge">CURRENT</span>}
                  {isPast    && <span className="past-badge">EXHAUSTED</span>}
                </div>
                <div className="planet-card-desc">
                  {isLocked ? 'Complete previous planets first.' : p.description}
                </div>
                {!isLocked && (
                  <div className="planet-card-stats">
                    <span className="pstat">⛏ {p.oreMultiplier}× yield</span>
                    {isCurrent && <span className="pstat">📊 {Math.round(damage * 100)}% depleted</span>}
                    {isNext && !currentExhausted && (
                      <span className="pstat" style={{ color: '#f5a623' }}>⚠ Exhaust {currentPlanetCfg.name} first</span>
                    )}
                  </div>
                )}
              </div>
              {isNext && currentExhausted && (
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
