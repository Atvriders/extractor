import { useState, useCallback } from 'react';
import type { GameState } from '../game/types';
import { computeStats } from '../game/stats';

interface FloatText { id: number; x: number; y: number; value: number }

interface Props {
  state: GameState;
  onClickPlanet: () => void;
}

let nextId = 0;

export default function Planet({ state, onClickPlanet }: Props) {
  const [floats, setFloats]   = useState<FloatText[]>([]);
  const [pressed, setPressed] = useState(false);
  const { orePerClick } = computeStats(state);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    onClickPlanet();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = nextId++;
    setFloats(f => [...f, { id, x, y, value: orePerClick }]);
    setTimeout(() => setFloats(f => f.filter(ft => ft.id !== id)), 900);
    setPressed(true);
    setTimeout(() => setPressed(false), 120);
  }, [onClickPlanet, orePerClick]);

  // Drone orbit dots
  const totalDrones = Object.values(state.drones).reduce((a, b) => a + b, 0);
  const orbitDots = Math.min(totalDrones, 40);

  return (
    <div className="planet-area">
      <div className={`planet-wrapper${pressed ? ' pressed' : ''}`} onClick={handleClick}>
        <div className="planet">
          <div className="planet-surface" />
          <div className="planet-glow" />
          {/* Orbit ring */}
          {orbitDots > 0 && (
            <div className="orbit-ring">
              {Array.from({ length: orbitDots }).map((_, i) => (
                <div
                  key={i}
                  className="orbit-dot"
                  style={{ '--i': i, '--total': orbitDots } as React.CSSProperties}
                />
              ))}
            </div>
          )}
        </div>
        {floats.map(ft => (
          <div
            key={ft.id}
            className="float-text"
            style={{ left: ft.x, top: ft.y }}
          >
            +{ft.value} ore
          </div>
        ))}
      </div>
      <div className="planet-label">Click to Extract</div>
      <div className="planet-sublabel">+{orePerClick} ore per click</div>
    </div>
  );
}
