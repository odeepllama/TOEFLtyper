// Word sources for typing tests.
import awl1 from '../data/awl_1_5.json';
import awl2 from '../data/awl_6_10.json';
import commonWords from '../data/common.json';
import sentenceData from '../data/sentences.json';
import type { Settings } from './settings.svelte';
import { getWeakWords } from './storage';

export interface AwlEntry {
  w: string;
  s: number;
  d: string;
  e: string;
  f: string[];
}

export const AWL: AwlEntry[] = [...(awl1 as AwlEntry[]), ...(awl2 as AwlEntry[])];
export const COMMON: string[] = commonWords as string[];
export const SENTENCES: { t: string; topic: string }[] = sentenceData as { t: string; topic: string }[];

/** Lookup any headword or family form -> AWL entry. */
export const awlIndex = new Map<string, AwlEntry>();
for (const e of AWL) {
  awlIndex.set(e.w.toLowerCase(), e);
  for (const f of e.f) if (!awlIndex.has(f.toLowerCase())) awlIndex.set(f.toLowerCase(), e);
}

export function lookupAwl(word: string): AwlEntry | undefined {
  const w = word.toLowerCase().replace(/[^a-z-]/g, '');
  return awlIndex.get(w);
}

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export interface WordStream {
  next(n: number): string[];
  /** finite sources (custom / sentences in words mode) report their total */
  finite: boolean;
  label: string;
}

function awlPool(s: Settings): string[] {
  const subs = s.sublists.length ? s.sublists : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const entries = AWL.filter((e) => subs.includes(e.s));
  const pool: string[] = [];
  for (const e of entries) {
    pool.push(e.w);
    if (s.families) for (const f of e.f) if (/^[a-z-]+$/.test(f)) pool.push(f);
  }
  return pool.length ? pool : AWL.map((e) => e.w);
}

function punctuate(words: string[], state: { sinceStop: number; cap: boolean }): string[] {
  return words.map((w) => {
    let out = state.cap ? w[0].toUpperCase() + w.slice(1) : w;
    state.cap = false;
    state.sinceStop++;
    const r = Math.random();
    if (state.sinceStop > 5 && r < 0.14) {
      out += pick(['.', '.', '.', '?', '!']);
      state.sinceStop = 0;
      state.cap = true;
    } else if (state.sinceStop > 2 && r < 0.24) {
      out += pick([',', ',', ',', ';', ':']);
    }
    return out;
  });
}

/** Generic random-pool stream that avoids immediate repeats. */
function poolStream(getWord: () => string, s: Settings, label: string): WordStream {
  const pstate = { sinceStop: 0, cap: true };
  let last = '';
  return {
    finite: false,
    label,
    next(n) {
      const out: string[] = [];
      while (out.length < n) {
        const w = getWord();
        if (w === last) continue;
        last = w;
        out.push(w);
      }
      return s.punctuation ? punctuate(out, pstate) : out;
    },
  };
}

function textStream(text: string, label: string, loop: boolean): WordStream {
  const all = text.split(/\s+/).filter(Boolean);
  let i = 0;
  return {
    finite: !loop,
    label,
    next(n) {
      const out: string[] = [];
      while (out.length < n) {
        if (i >= all.length) {
          if (!loop || all.length === 0) break;
          i = 0;
        }
        out.push(all[i++]);
      }
      return out;
    },
  };
}

function sentenceStream(): WordStream {
  const order = [...SENTENCES].sort(() => Math.random() - 0.5);
  let si = 0;
  let buf: string[] = [];
  return {
    finite: false,
    label: 'academic sentences',
    next(n) {
      while (buf.length < n) {
        buf.push(...order[si % order.length].t.split(/\s+/));
        si++;
      }
      return buf.splice(0, n);
    },
  };
}

export function createStream(s: Settings): { stream: WordStream; notice?: string } {
  switch (s.source) {
    case 'common200': {
      const pool = COMMON.slice(0, 200);
      return { stream: poolStream(() => pick(pool), s, 'top 200 words') };
    }
    case 'common1000':
      return { stream: poolStream(() => pick(COMMON), s, 'top 1000 words') };
    case 'awl': {
      const pool = awlPool(s);
      return { stream: poolStream(() => pick(pool), s, 'academic word list') };
    }
    case 'mixed': {
      const pool = awlPool(s);
      const common = COMMON.slice(0, 500);
      return {
        stream: poolStream(
          () => (Math.random() * 100 < s.awlRatio ? pick(pool) : pick(common)),
          s,
          `mixed (${s.awlRatio}% AWL)`,
        ),
      };
    }
    case 'sentences':
      return { stream: sentenceStream() };
    case 'custom': {
      const text = s.customText.trim();
      if (!text) {
        return {
          stream: poolStream(() => pick(COMMON), s, 'top 1000 words'),
          notice: 'No custom text yet. Add some in the custom text box.',
        };
      }
      return { stream: textStream(text, 'custom text', s.mode === 'time') };
    }
    case 'weak': {
      const weak = getWeakWords();
      const entries = Object.entries(weak);
      if (entries.length < 8) {
        const pool = awlPool(s);
        return {
          stream: poolStream(() => pick(pool), s, 'academic word list'),
          notice: 'Not enough weak words recorded yet; practising the AWL instead.',
        };
      }
      const total = entries.reduce((a, [, v]) => a + v, 0);
      return {
        stream: poolStream(
          () => {
            let r = Math.random() * total;
            for (const [w, v] of entries) {
              r -= v;
              if (r <= 0) return w;
            }
            return entries[0][0];
          },
          s,
          'weak words',
        ),
      };
    }
  }
}

