import type { GameState } from '../game/types';
import { UPGRADES, isUnlocked, canAfford } from '../game/upgrades';

interface Props {
  state: GameState;
  onBuy: (id: string) => void;
}

const UPG_NAME: Record<string, string> = Object.fromEntries(
  UPGRADES.map(u => [u.id, u.name])
);

function fmt(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toString();
}

export default function ResearchPanel({ state, onBuy }: Props) {
  return (
    <div className="panel">
      <h2 className="panel-title">Research</h2>
      <div className="research-list">
        {UPGRADES.map(upg => {
          const purchased  = state.upgrades.includes(upg.id);
          const unlocked   = isUnlocked(upg, state.upgrades);
          const affordable = canAfford(upg, state);

          if (purchased) {
            return (
              <div key={upg.id} className="research-card purchased">
                <div className="research-name">✓ {upg.name}</div>
                <div className="research-desc">{upg.desc}</div>
              </div>
            );
          }

          if (!unlocked) {
            const reqNames = (upg.requires ?? []).map(r => UPG_NAME[r] ?? r).join(' + ');
            return (
              <div key={upg.id} className="research-card locked">
                <div className="research-name">🔒 {upg.name}</div>
                <div className="research-desc">Requires: {reqNames}</div>
              </div>
            );
          }

          return (
            <div key={upg.id} className={`research-card${affordable ? '' : ' unaffordable'}`}>
              <div className="research-header">
                <div className="research-name">{upg.name}</div>
                <div className="research-cost">
                  <span className="cost-item rp">{fmt(upg.rpCost)} RP</span>
                  {upg.creditCost ? <span className="cost-item cred">{fmt(upg.creditCost)} cr</span> : null}
                </div>
              </div>
              <div className="research-desc">{upg.desc}</div>
              <button
                className="buy-btn research-btn"
                disabled={!affordable}
                onClick={() => onBuy(upg.id)}
              >
                Research
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
