import type { GameState, DroneType } from '../game/types';
import { computeStats, droneCost } from '../game/stats';

interface Props {
  state: GameState;
  onBuy: (drone: DroneType) => void;
}

function fmt(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toString();
}

function pct(n: number, decimals = 0) {
  return (n * 100).toFixed(decimals) + '%';
}

export default function DronePanel({ state, onBuy }: Props) {
  const stats = computeStats(state);
  const { fabDiscount, researchDiscount, minerClickBonus } = stats;
  const d = state.drones;

  const minerClickPct   = pct(minerClickBonus - 1);
  const resDiscountPct  = pct(researchDiscount);
  const traderRp        = (d.trader * 0.02).toFixed(2);
  const fabOrePct       = pct(Math.min(d.fabricator * 0.008, 0.15));

  const DRONES: Array<{
    id: DroneType; name: string; icon: string; desc: string; stat: string;
  }> = [
    {
      id: 'miner', name: 'Miner Drone', icon: '🤖',
      desc: 'Automatically extracts ore. Swarms improve click efficiency.',
      stat: `+0.5 ore/sec · +${minerClickPct} ore/click`,
    },
    {
      id: 'researcher', name: 'Researcher Drone', icon: '🧬',
      desc: 'Generates research points and reduces upgrade costs.',
      stat: `+0.1 RP/sec · −${resDiscountPct} research costs`,
    },
    {
      id: 'trader', name: 'Trader Drone', icon: '📦',
      desc: 'Earns credits and sends back trade intelligence as RP.',
      stat: d.trader > 0
        ? `+1.0 cr/sec · +${traderRp} RP/sec`
        : '+1.0 cr/sec · +0.02 RP/sec per drone',
    },
    {
      id: 'fabricator', name: 'Fabricator Drone', icon: '⚙️',
      desc: 'Cuts drone costs and streamlines the extraction pipeline.',
      stat: `−${pct(fabDiscount)} drone costs · +${fabOrePct} ore/sec`,
    },
  ];

  return (
    <div className="panel">
      <h2 className="panel-title">Drones</h2>
      <div className="drone-list">
        {DRONES.map(def => {
          const count = d[def.id] ?? 0;
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
                <div className="drone-stat">{def.stat}</div>
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
