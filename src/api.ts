// Cloud save & leaderboard API client
// In production, Nginx proxies /api/ → extractor-api:4000
// In local dev, point VITE_API_URL to http://localhost:4000
const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

export interface LeaderboardEntry {
  username: string;
  total_ore: number;
  updated_at: number;
}

function fetchWithTimeout(url: string, ms = 4000): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(id));
}

export async function apiLoad(username: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/save/${username}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { save: Record<string, unknown> };
    return data.save;
  } catch {
    return null;
  }
}

export async function apiSave(username: string, state: unknown): Promise<void> {
  try {
    await fetch(`${API_BASE}/save/${username}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
  } catch {
    // Cloud save failed silently — local save still works
  }
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch(`${API_BASE}/leaderboard`);
    if (!res.ok) return [];
    const data = await res.json() as { leaderboard: LeaderboardEntry[] };
    return data.leaderboard;
  } catch {
    return [];
  }
}
