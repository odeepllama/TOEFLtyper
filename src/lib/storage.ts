// Local persistence for typing results, personal bests, key stats and weak words.
import type { Mode, Source } from './settings.svelte';

export interface Sample {
  wpm: number; // cumulative net WPM at this second
  raw: number; // raw WPM during this second
  err: number; // errors during this second
}

export interface KeyStat {
  n: number; // presses
  e: number; // errors
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
}

const K = {
  history: 'toefltyper.history.v1',
  keys: 'toefltyper.keys.v1',
  weak: 'toefltyper.weak.v1',
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
  // History stores summaries only (samples/keys are large).
  const { samples: _s, keys, missed, ...summary } = r;
  const hist = getHistory();
  hist.push(summary);
  if (hist.length > MAX_HISTORY) hist.splice(0, hist.length - MAX_HISTORY);
  write(K.history, hist);

  if (keys) {
    const all = getKeyStats();
    for (const [k, v] of Object.entries(keys)) {
      const cur = all[k] ?? { n: 0, e: 0 };
      cur.n += v.n;
      cur.e += v.e;
      all[k] = cur;
    }
    write(K.keys, all);
  }

  const weak = getWeakWords();
  // Words typed correctly slowly "heal"; missed words get heavier.
  for (const w of missed ?? []) weak[w] = (weak[w] ?? 0) + 2;
  for (const w of Object.keys(weak)) {
    weak[w] -= 0.25;
    if (weak[w] <= 0) delete weak[w];
  }
  write(K.weak, weak);
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

