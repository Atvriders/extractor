import type { GameState, DroneType } from '../game/types';
import { computeStats, droneCost } from '../game/stats';

interface Props {
  state: GameState;
  onBuy: (drone: DroneType) => void;
}

interface DroneDef {
  id: DroneType;
  name: string;
  icon: string;
  desc: string;
  statDesc: (fabDiscount: number) => string;
}

const DRONES: DroneDef[] = [
  {
    id: 'miner',
    name: 'Miner Drone',
    icon: '🤖',
    desc: 'Automatically extracts ore from the planet surface.',
    statDesc: () => '+0.5 ore/sec',
  },
  {
    id: 'researcher',
    name: 'Researcher Drone',
    icon: '🧬',
    desc: 'Analyses extracted material to generate research points.',
    statDesc: () => '+0.1 RP/sec',
  },
  {
    id: 'trader',
    name: 'Trader Drone',
    icon: '📦',
    desc: 'Trades resources on the galactic market for credits.',
    statDesc: () => '+1.0 credits/sec',
  },
  {
    id: 'fabricator',
    name: 'Fabricator Drone',
    icon: '⚙️',
    desc: 'Optimises production lines, reducing all drone costs.',
    statDesc: (fab) => `-${(fab * 100).toFixed(0)}% drone costs`,
  },
];

function fmt(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toString();
}

export default function DronePanel({ state, onBuy }: Props) {
  const { fabDiscount } = computeStats(state);

  return (
    <div className="panel">
      <h2 className="panel-title">Drones</h2>
      <div className="drone-list">
        {DRONES.map(def => {
          const count = state.drones[def.id] ?? 0;
          const cost  = droneCost(def.id, count, fabDiscount);
          const canBuy =
            Number.isFinite(cost.ore) &&
            state.ore     >= cost.ore &&
            state.credits >= cost.credits &&
            state.rp      >= cost.rp;

          return (
            <div key={def.id} className={`drone-card${canBuy ? '' : ' unaffordable'}`}>
              <div className="drone-icon">{def.icon}</div>
              <div className="drone-info">
                <div className="drone-name">{def.name} <span className="drone-count">×{count}</span></div>
                <div className="drone-desc">{def.desc}</div>
                <div className="drone-stat">{def.statDesc(fabDiscount)}</div>
              </div>
              <div className="drone-buy-col">
                <button
                  className="buy-btn"
                  disabled={!canBuy}
                  onClick={() => onBuy(def.id)}
                >
                  Buy
                </button>
                <div className="cost-list">
                  <span className="cost-item ore">{fmt(cost.ore)} ore</span>
                  {cost.credits > 0 && <span className="cost-item cred">{fmt(cost.credits)} cr</span>}
                  {cost.rp      > 0 && <span className="cost-item rp">{fmt(cost.rp)} RP</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
