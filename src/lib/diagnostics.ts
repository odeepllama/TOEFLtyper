// Timing, Sequencing, Transposition, Hesitation, and Backspace-Trigger Diagnostics Engine.

export interface KeyEventLog {
  t: number; // ms since test start (performance.now)
  dt: number; // inter-key interval (ms) since previous keystroke
  expected: string; // expected character (or 'BACK' on backspace)
  typed: string; // character pressed (or 'BACK' on backspace)
  ok: boolean;
  word: string; // target word being typed
  charIdx: number; // index inside word
}

export interface DiagnosticFinding {
  category:
    | 'transposition'
    | 'hesitation'
    | 'backspace_trigger'
    | 'adjacent_fatfinger'
    | 'same_finger_rush'
    | 'pinky_ring';
  title: string;
  severity: 'high' | 'medium' | 'low';
  summary: string;
  examples: string[];
  preventionTip: string;
  drillWords: string[];
}

export interface TelemetryReport {
  medianIkiMs: number;
  p90IkiMs: number;
  transpositions: { pair: string; word: string; gapMs: number }[];
  hesitationKeys: { key: string; avgMs: number; maxMs: number; count: number; words: string[] }[];
  deleteTriggers: { trigger: string; count: number; words: string[] }[];
  adjacentMistakes: { expected: string; typed: string; count: number; words: string[] }[];
  findings: DiagnosticFinding[];
  recommendedDrillWords: string[];
}

// Physical QWERTY row/column coordinates for adjacency & finger assignment
const KEY_POS: Record<string, { r: number; c: number; finger: string }> = {
  q: { r: 0, c: 0, finger: 'L-pinky' },
  w: { r: 0, c: 1, finger: 'L-ring' },
  e: { r: 0, c: 2, finger: 'L-middle' },
  r: { r: 0, c: 3, finger: 'L-index' },
  t: { r: 0, c: 4, finger: 'L-index' },
  y: { r: 0, c: 5, finger: 'R-index' },
  u: { r: 0, c: 6, finger: 'R-index' },
  i: { r: 0, c: 7, finger: 'R-middle' },
  o: { r: 0, c: 8, finger: 'R-ring' },
  p: { r: 0, c: 9, finger: 'R-pinky' },
  a: { r: 1, c: 0.2, finger: 'L-pinky' },
  s: { r: 1, c: 1.2, finger: 'L-ring' },
  d: { r: 1, c: 2.2, finger: 'L-middle' },
  f: { r: 1, c: 3.2, finger: 'L-index' },
  g: { r: 1, c: 4.2, finger: 'L-index' },
  h: { r: 1, c: 5.2, finger: 'R-index' },
  j: { r: 1, c: 6.2, finger: 'R-index' },
  k: { r: 1, c: 7.2, finger: 'R-middle' },
  l: { r: 1, c: 8.2, finger: 'R-ring' },
  ';': { r: 1, c: 9.2, finger: 'R-pinky' },
  z: { r: 2, c: 0.6, finger: 'L-pinky' },
  x: { r: 2, c: 1.6, finger: 'L-ring' },
  c: { r: 2, c: 2.6, finger: 'L-middle' },
  v: { r: 2, c: 3.6, finger: 'L-index' },
  b: { r: 2, c: 4.6, finger: 'L-index' },
  n: { r: 2, c: 5.6, finger: 'R-index' },
  m: { r: 2, c: 6.6, finger: 'R-index' },
  ',': { r: 2, c: 7.6, finger: 'R-middle' },
  '.': { r: 2, c: 8.6, finger: 'R-ring' },
  '/': { r: 2, c: 9.6, finger: 'R-pinky' },
};

function isAdjacentKey(a: string, b: string): boolean {
  const pa = KEY_POS[a.toLowerCase()];
  const pb = KEY_POS[b.toLowerCase()];
  if (!pa || !pb) return false;
  const dr = Math.abs(pa.r - pb.r);
  const dc = Math.abs(pa.c - pb.c);
  return dr <= 1 && dc <= 1.25 && !(dr === 0 && dc === 0);
}

export function analyzeKeystrokeTelemetry(events: KeyEventLog[]): TelemetryReport {
  const forwardEvents = events.filter((e) => e.typed !== 'BACK' && e.dt > 0 && e.dt < 4000);
  const ikis = forwardEvents.map((e) => e.dt).sort((a, b) => a - b);
  const medianIkiMs = ikis.length ? Math.round(ikis[Math.floor(ikis.length * 0.5)]) : 150;
  const p90IkiMs = ikis.length ? Math.round(ikis[Math.floor(ikis.length * 0.9)]) : 280;

  // 1. Detect Key Order Transpositions (e.g. target has "th" at i,i+1 and user typed "ht")
  const transpositions: { pair: string; word: string; gapMs: number }[] = [];
  for (let i = 0; i < events.length - 1; i++) {
    const e1 = events[i];
    const e2 = events[i + 1];
    if (
      e1.typed !== 'BACK' &&
      e2.typed !== 'BACK' &&
      !e1.ok &&
      !e2.ok &&
      e1.word === e2.word &&
      e2.charIdx === e1.charIdx + 1 &&
      e1.typed.toLowerCase() === e2.expected.toLowerCase() &&
      e2.typed.toLowerCase() === e1.expected.toLowerCase() &&
      e1.expected.toLowerCase() !== e2.expected.toLowerCase()
    ) {
      transpositions.push({
        pair: `${e1.expected}${e2.expected} → ${e1.typed}${e2.typed}`,
        word: e1.word,
        gapMs: Math.round(e2.dt),
      });
    }
  }

  // 2. Excess Time to Find Key (Hesitation Spikes: dt > max(median * 2.1, 280ms))
  const thresholdMs = Math.max(medianIkiMs * 2.1, 260);
  const keyTimings = new Map<string, { dts: number[]; words: Set<string> }>();
  for (const e of forwardEvents) {
    if (e.expected === ' ' || !e.expected) continue;
    const k = e.expected.toLowerCase();
    const cur = keyTimings.get(k) ?? { dts: [], words: new Set<string>() };
    cur.dts.push(e.dt);
    if (e.dt >= thresholdMs) cur.words.add(e.word.replace(/[^a-zA-Z-]/g, ''));
    keyTimings.set(k, cur);
  }

  const hesitationKeys: { key: string; avgMs: number; maxMs: number; count: number; words: string[] }[] = [];
  for (const [k, info] of keyTimings.entries()) {
    const slowCount = info.dts.filter((d) => d >= thresholdMs).length;
    if (slowCount >= 1 && info.dts.length >= 2) {
      const avg = Math.round(info.dts.reduce((a, b) => a + b, 0) / info.dts.length);
      const max = Math.round(Math.max(...info.dts));
      if (avg >= medianIkiMs * 1.45 || max >= thresholdMs * 1.25) {
        hesitationKeys.push({
          key: k,
          avgMs: avg,
          maxMs: max,
          count: slowCount,
          words: [...info.words].filter(Boolean).slice(0, 4),
        });
      }
    }
  }
  hesitationKeys.sort((a, b) => b.avgMs - a.avgMs);

  // 3. Keys / Mistakes That Trigger Deletes (Backspaces)
  const deleteMap = new Map<string, { count: number; words: Set<string> }>();
  for (let i = 1; i < events.length; i++) {
    if (events[i].typed === 'BACK') {
      // Walk back to the non-BACK keystroke that prompted this delete burst
      let j = i - 1;
      while (j >= 0 && events[j].typed === 'BACK') j--;
      if (j >= 0) {
        const cause = events[j];
        const exp = cause.expected === ' ' ? 'space' : cause.expected.toLowerCase();
        const typ = cause.typed === ' ' ? 'space' : cause.typed.toLowerCase();
        const label = cause.ok ? `${exp} (over-deleted)` : `${exp} → ${typ}`;
        const cur = deleteMap.get(label) ?? { count: 0, words: new Set<string>() };
        cur.count++;
        if (cause.word) cur.words.add(cause.word.replace(/[^a-zA-Z-]/g, ''));
        deleteMap.set(label, cur);
        // Skip consecutive backspaces in the same burst so one mistake isn't counted 4 times
        while (i + 1 < events.length && events[i + 1].typed === 'BACK') i++;
      }
    }
  }
  const deleteTriggers = [...deleteMap.entries()]
    .map(([trigger, v]) => ({ trigger, count: v.count, words: [...v.words].filter(Boolean).slice(0, 4) }))
    .sort((a, b) => b.count - a.count);

  // 4. Adjacent-Key Fat-Fingering
  const adjMap = new Map<string, { expected: string; typed: string; count: number; words: Set<string> }>();
  for (const e of events) {
    if (e.typed !== 'BACK' && !e.ok && isAdjacentKey(e.expected, e.typed)) {
      const k = `${e.expected.toLowerCase()}→${e.typed.toLowerCase()}`;
      const cur = adjMap.get(k) ?? {
        expected: e.expected.toLowerCase(),
        typed: e.typed.toLowerCase(),
        count: 0,
        words: new Set<string>(),
      };
      cur.count++;
      if (e.word) cur.words.add(e.word.replace(/[^a-zA-Z-]/g, ''));
      adjMap.set(k, cur);
    }
  }
  const adjacentMistakes = [...adjMap.values()]
    .map((v) => ({ expected: v.expected, typed: v.typed, count: v.count, words: [...v.words].slice(0, 4) }))
    .sort((a, b) => b.count - a.count);

  // Build actionable findings & prevention steps
  const findings: DiagnosticFinding[] = [];
  const drillSet = new Set<string>();

  if (transpositions.length > 0) {
    const ex = transpositions.slice(0, 4).map((t) => `${t.pair} in "${t.word}" (${t.gapMs}ms gap)`);
    transpositions.forEach((t) => drillSet.add(t.word.replace(/[^a-zA-Z-]/g, '').toLowerCase()));
    findings.push({
      category: 'transposition',
      title: `Key-Order Transpositions (${transpositions.length} detected)`,
      severity: transpositions.length >= 2 ? 'high' : 'medium',
      summary:
        'Two consecutive letters were struck in reverse order—typically when a dominant finger on one hand fires before the opposite hand finishes its stroke.',
      examples: ex,
      preventionTip:
        'Slow down slightly on alternating-hand bigrams (like "th", "er", "in", "re") and aim for an even metronome cadence (~' +
        medianIkiMs +
        'ms per key) rather than burst-typing familiar prefixes.',
      drillWords: transpositions.map((t) => t.word),
    });
  }

  if (hesitationKeys.length > 0) {
    const topSlow = hesitationKeys.slice(0, 4);
    topSlow.forEach((h) => h.words.forEach((w) => drillSet.add(w.toLowerCase())));
    findings.push({
      category: 'hesitation',
      title: `Excess Time to Find Key (Baseline: ${medianIkiMs}ms/key)`,
      severity: topSlow[0].avgMs > medianIkiMs * 2 ? 'high' : 'medium',
      summary: `Your normal rhythm is ${medianIkiMs}ms per keystroke, but you paused significantly longer when searching for: ${topSlow
        .map((h) => `"${h.key.toUpperCase()}" (avg ${h.avgMs}ms, peak ${h.maxMs}ms)`)
        .join(', ')}.`,
      examples: topSlow.map(
        (h) => `Key "${h.key.toUpperCase()}": ${h.avgMs}ms avg (${Math.round((h.avgMs / Math.max(1, medianIkiMs)) * 100)}% of normal time) in ${h.words.join(', ') || 'test'}`,
      ),
      preventionTip:
        'Keep your index fingers anchored lightly on the F and J homing bumps so your fingers reach top-row and bottom-row keys by muscle memory without looking down or hesitating.',
      drillWords: topSlow.flatMap((h) => h.words),
    });
  }

  if (deleteTriggers.length > 0) {
    const topDel = deleteTriggers.slice(0, 4);
    topDel.forEach((d) => d.words.forEach((w) => drillSet.add(w.toLowerCase())));
    findings.push({
      category: 'backspace_trigger',
      title: `Mistakes Leading to Backspace Deletes (${deleteTriggers.reduce((a, b) => a + b.count, 0)} bursts)`,
      severity: deleteTriggers.length >= 3 ? 'high' : 'medium',
      summary:
        'Every backspace burst costs 3–5 keystrokes of WPM momentum. These specific character transitions triggered your delete corrections:',
      examples: topDel.map((d) => `${d.trigger} (${d.count}×) in ${d.words.join(', ') || 'test'}`),
      preventionTip:
        'Look 1–2 words ahead while your fingers finish the current word, and use Option+Backspace (Ctrl+Backspace on PC) if an error happens more than 3 characters back.',
      drillWords: topDel.flatMap((d) => d.words),
    });
  }

  if (adjacentMistakes.length > 0) {
    const topAdj = adjacentMistakes.slice(0, 4);
    topAdj.forEach((a) => a.words.forEach((w) => drillSet.add(w.toLowerCase())));
    findings.push({
      category: 'adjacent_fatfinger',
      title: `Adjacent-Key Neighbor Slips (${adjacentMistakes.reduce((a, b) => a + b.count, 0)}×)`,
      severity: 'medium',
      summary:
        'You struck a neighboring key on the QWERTY grid instead of the target key—usually caused by lateral hand drift off the home row.',
      examples: topAdj.map((a) => `Expected "${a.expected.toUpperCase()}", hit "${a.typed.toUpperCase()}" (${a.count}×)`),
      preventionTip:
        'Curl your fingers slightly so only the fingertip pad contacts the center of the keycap, and re-center your palms after wide reaches.',
      drillWords: topAdj.flatMap((a) => a.words),
    });
  }

  return {
    medianIkiMs,
    p90IkiMs,
    transpositions,
    hesitationKeys: hesitationKeys.slice(0, 6),
    deleteTriggers: deleteTriggers.slice(0, 6),
    adjacentMistakes: adjacentMistakes.slice(0, 6),
    findings,
    recommendedDrillWords: [...drillSet].filter((w) => w.length >= 3),
  };
}

