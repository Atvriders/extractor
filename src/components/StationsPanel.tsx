import type { GameState, StationType } from '../game/types';
import { stationCost } from '../game/stats';

interface Props {
  state: GameState;
  onBuy: (station: StationType) => void;
}

interface StationDef {
  id:       StationType;
  name:     string;
  icon:     string;
  desc:     string;
  bonus:    string;
}

const STATIONS: StationDef[] = [
  {
    id:    'mining',
    name:  'Mining Station',
    icon:  '⛏️',
    desc:  'Automated orbital platform that amplifies all surface ore extraction.',
    bonus: '+25% ore/sec per station',
  },
  {
    id:    'research',
    name:  'Research Station',
    icon:  '🔬',
    desc:  'Zero-gravity laboratory complex that passively generates research output.',
    bonus: '+0.5 RP/sec flat per station',
  },
  {
    id:    'market',
    name:  'Market Station',
    icon:  '🏦',
    desc:  'Deep-space trading hub expanding galactic trade routes and credit flow.',
    bonus: '+15% credits/sec per station',
  },
  {
    id:    'fabricator',
    name:  'Fabricator Station',
    icon:  '🏭',
    desc:  'Industrial forge that raises the Fabricator drone discount cap by 2% per station.',
    bonus: '+2% fab discount cap (max +10%)',
  },
];

function fmt(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toString();
}

export default function StationsPanel({ state, onBuy }: Props) {
  const stations = state.stations ?? { mining: 0, research: 0, market: 0, fabricator: 0 };

  return (
    <div className="panel">
      <h2 className="panel-title">Stations</h2>
      <div className="drone-list">
        {STATIONS.map(def => {
          const count  = stations[def.id] ?? 0;
          const cost   = stationCost(def.id, count);
          const canBuy = state.ore >= cost.ore && state.credits >= cost.credits;

          return (
            <div key={def.id} className={`drone-card${canBuy ? '' : ' unaffordable'}`}>
              <div className="drone-icon">{def.icon}</div>
              <div className="drone-info">
                <div className="drone-name">
                  {def.name} <span className="drone-count">×{count}</span>
                </div>
                <div className="drone-desc">{def.desc}</div>
                <div className="drone-stat">{def.bonus}</div>
              </div>
              <div className="drone-buy-col">
                <button
                  className="buy-btn"
                  disabled={!canBuy}
                  onClick={() => onBuy(def.id)}
                >
                  Build
                </button>
                <div className="cost-list">
                  <span className="cost-item ore">{fmt(cost.ore)} ore</span>
                  <span className="cost-item cred">{fmt(cost.credits)} cr</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
