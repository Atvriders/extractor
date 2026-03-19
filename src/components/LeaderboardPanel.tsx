import { useEffect, useState } from 'react';
import { fetchLeaderboard, type LeaderboardEntry } from '../api';

interface Props { currentUsername: string; totalOre: number }

function fmt(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.floor(n).toString();
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const RANK_ICONS = ['🥇', '🥈', '🥉'];

export default function LeaderboardPanel({ currentUsername, totalOre }: Props) {
  const [rows, setRows]       = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchLeaderboard().then(data => { setRows(data); setLoading(false); });
  }, [totalOre]); // refresh when ore changes (debounced naturally by React re-render)

  return (
    <div className="panel">
      <h2 className="panel-title">Leaderboard</h2>
      {loading ? (
        <div className="lb-loading">Scanning galaxy…</div>
      ) : rows.length === 0 ? (
        <div className="lb-empty">No commanders yet — be the first!</div>
      ) : (
        <div className="lb-list">
          {rows.map((row, i) => {
            const isSelf = row.username.toLowerCase() === currentUsername.toLowerCase();
            return (
              <div key={row.username} className={`lb-row ${isSelf ? 'lb-self' : ''}`}>
                <span className="lb-rank">{RANK_ICONS[i] ?? `#${i + 1}`}</span>
                <span className="lb-name">{row.username}{isSelf ? ' (you)' : ''}</span>
                <span className="lb-ore">{fmt(row.total_ore)} ore</span>
                <span className="lb-time">{timeAgo(row.updated_at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
