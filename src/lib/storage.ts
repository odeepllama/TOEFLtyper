// Local persistence for typing results, personal bests, key stats, telemetry diagnostics, and shared cloud leaderboard.
import type { Mode, Source } from './settings.svelte';
import { settings } from './settings.svelte';

export interface Sample {
  wpm: number; // cumulative net WPM at this second
  raw: number; // raw WPM during this second
  err: number; // errors during this second
}

export interface KeyStat {
  n: number; // presses
  e: number; // errors
  ms?: number; // cumulative inter-key latency (ms)
  del?: number; // times this key triggered a backspace delete
}

export interface CharCounts {
  correct: number;
  incorrect: number;
  extra: number;
  missed: number;
}

export interface TestResult {
  id: string;
  date: number;
  mode: Mode;
  limit: number; // seconds or words (0 for zen)
  source: Source;
  punctuation: boolean;
  wpm: number;
  raw: number;
  acc: number;
  consistency: number;
  duration: number; // seconds
  chars: CharCounts;
  samples?: Sample[];
  keys?: Record<string, KeyStat>;
  missed?: string[];
  transpositions?: string[]; // e.g. ["th→ht"]
  deleteTriggers?: string[]; // e.g. ["r→t"]
  slowestKeys?: { key: string; avgMs: number }[];
}

export interface SharedScoreEntry {
  machineId: string;
  alias: string; // e.g. "Patekster-42", "Omyga-07"
  wpm: number;
  raw: number;
  acc: number;
  consistency: number;
  mode: Mode;
  limit: number;
  source: Source;
  date: number;
}

const DEFAULT_CLOUD_ENDPOINT = 'https://api.restful-api.dev/objects/ff808181a09d98f701a1dc39d7292d06';

const K = {
  history: 'toefltyper.history.v1',
  keys: 'toefltyper.keys.v1',
  weak: 'toefltyper.weak.v1',
  cloudCache: 'toefltyper.cloud_board.v1',
};

const MAX_HISTORY = 2000;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Storage write failed', e);
  }
}

export function pbKey(r: Pick<TestResult, 'mode' | 'limit' | 'source' | 'punctuation'>) {
  return `${r.mode}|${r.limit}|${r.source}|${r.punctuation ? 'p' : ''}`;
}

export function getHistory(): TestResult[] {
  return read<TestResult[]>(K.history, []);
}

export function getKeyStats(): Record<string, KeyStat> {
  return read(K.keys, {});
}

export function getWeakWords(): Record<string, number> {
  return read(K.weak, {});
}

export function getCachedCloudScores(): SharedScoreEntry[] {
  return read<SharedScoreEntry[]>(K.cloudCache, []);
}

/** Best WPM for this configuration, before the given result was added. */
export function bestFor(r: Pick<TestResult, 'mode' | 'limit' | 'source' | 'punctuation'>, excludeId?: string) {
  const k = pbKey(r);
  let best: TestResult | null = null;
  for (const h of getHistory()) {
    if (h.id === excludeId || pbKey(h) !== k) continue;
    if (!best || h.wpm > best.wpm) best = h;
  }
  return best;
}

export function saveResult(r: TestResult) {
  const { samples: _s, keys, missed, ...summary } = r;
  const hist = getHistory();
  hist.push(summary);
  if (hist.length > MAX_HISTORY) hist.splice(0, hist.length - MAX_HISTORY);
  write(K.history, hist);

  if (keys) {
    const all = getKeyStats();
    for (const [k, v] of Object.entries(keys)) {
      const cur = all[k] ?? { n: 0, e: 0, ms: 0, del: 0 };
      cur.n += v.n;
      cur.e += v.e;
      cur.ms = (cur.ms ?? 0) + (v.ms ?? 0);
      cur.del = (cur.del ?? 0) + (v.del ?? 0);
      all[k] = cur;
    }
    write(K.keys, all);
  }

  const weak = getWeakWords();
  for (const w of missed ?? []) weak[w] = (weak[w] ?? 0) + 2;
  for (const w of Object.keys(weak)) {
    weak[w] -= 0.25;
    if (weak[w] <= 0) delete weak[w];
  }
  write(K.weak, weak);

  if (settings.cloudSync && r.wpm > 0 && r.acc >= 50) {
    void publishScoreToCloud(r);
  }
}

function getEndpoint(): string {
  return settings.customCloudUrl.trim() || DEFAULT_CLOUD_ENDPOINT;
}

/** Fetch cross-machine shared leaderboard scores. */
export async function fetchCloudScores(): Promise<SharedScoreEntry[]> {
  const url = getEndpoint();
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    const list: SharedScoreEntry[] = Array.isArray(payload?.data?.scores)
      ? payload.data.scores
      : Array.isArray(payload?.scores)
        ? payload.scores
        : [];
    write(K.cloudCache, list);
    return list;
  } catch {
    return getCachedCloudScores();
  }
}

/** Merge & push a new score to the shared cross-machine leaderboard. */
export async function publishScoreToCloud(r: TestResult): Promise<SharedScoreEntry[]> {
  const entry: SharedScoreEntry = {
    machineId: settings.machineId,
    alias: settings.machineAlias,
    wpm: r.wpm,
    raw: r.raw,
    acc: r.acc,
    consistency: r.consistency,
    mode: r.mode,
    limit: r.limit,
    source: r.source,
    date: r.date,
  };

  const existing = await fetchCloudScores();
  // Keep each machine's best per (mode, limit, source) + overall recent top 120 entries
  const merged = [...existing];
  // Update alias on older entries from the same machineId
  for (const item of merged) {
    if (item.machineId === entry.machineId) {
      item.alias = entry.alias;
    }
  }
  const sameSlotIdx = merged.findIndex(
    (x) =>
      x.machineId === entry.machineId &&
      x.mode === entry.mode &&
      x.limit === entry.limit &&
      x.source === entry.source,
  );
  if (sameSlotIdx >= 0) {
    if (entry.wpm >= merged[sameSlotIdx].wpm) {
      merged[sameSlotIdx] = entry;
    }
  } else {
    merged.push(entry);
  }

  merged.sort((a, b) => b.wpm - a.wpm || b.acc - a.acc || b.date - a.date);
  const trimmed = merged.slice(0, 120);
  write(K.cloudCache, trimmed);

  const url = getEndpoint();
  try {
    await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'toefltyper-leaderboard',
        data: { scores: trimmed },
      }),
    });
  } catch {
    // Offline fallback already saved in cloudCache
  }
  return trimmed;
}

export function exportAll(): string {
  return JSON.stringify(
    { version: 1, exported: Date.now(), history: getHistory(), keys: getKeyStats(), weak: getWeakWords() },
    null,
    2,
  );
}

export function importAll(json: string) {
  const data = JSON.parse(json);
  if (!data || data.version !== 1) throw new Error('Unrecognised file');
  write(K.history, data.history ?? []);
  write(K.keys, data.keys ?? {});
  write(K.weak, data.weak ?? {});
}

export function resetAll() {
  for (const k of Object.values(K)) localStorage.removeItem(k);
}
