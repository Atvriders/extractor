import type { GameState } from '../game/types';
import { computeStats } from '../game/stats';

function fmt(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.floor(n).toString();
}

function fmtRate(n: number): string {
  if (n === 0) return '';
  return `+${n >= 1 ? fmt(n) : n.toFixed(2)}/s`;
}

export default function ResourceBar({ state }: { state: GameState }) {
  const { orePerSec, creditsPerSec, rpPerSec } = computeStats(state);

  return (
    <div className="resource-bar">
      <div className="resource-item">
        <span className="res-icon">⛏</span>
        <span className="res-value">{fmt(state.ore)}</span>
        <span className="res-label">Ore</span>
        {orePerSec > 0 && <span className="res-rate">{fmtRate(orePerSec)}</span>}
      </div>
      <div className="resource-item">
        <span className="res-icon">💳</span>
        <span className="res-value">{fmt(state.credits)}</span>
        <span className="res-label">Credits</span>
        {creditsPerSec > 0 && <span className="res-rate">{fmtRate(creditsPerSec)}</span>}
      </div>
      <div className="resource-item">
        <span className="res-icon">🔬</span>
        <span className="res-value">{fmt(state.rp)}</span>
        <span className="res-label">Research</span>
        {rpPerSec > 0 && <span className="res-rate">{fmtRate(rpPerSec)}</span>}
      </div>
    </div>
  );
}
