<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { settings, rerollWatchAlias, type Mode, type Source, type SoundPack } from '../lib/settings.svelte';
  import { createStream, lookupAwl, type AwlEntry, type WordStream } from '../lib/words';
  import { playClick, SOUND_PACKS } from '../lib/sound';
  import {
    saveResult,
    bestFor,
    getSprintState,
    SPRINT_MAX_TOKENS,
    SPRINT_RUNS_PER_TOKEN,
    type SprintState,
    type TestResult,
    type Sample,
    type KeyStat,
  } from '../lib/storage';
  import { analyzeKeystrokeTelemetry, type KeyEventLog, type TelemetryReport } from '../lib/diagnostics';
  import LineChart from '../components/LineChart.svelte';
  import Keyboard from '../components/Keyboard.svelte';

  interface WordState {
    target: string;
    typed: string;
    done: boolean;
  }

  let words = $state<WordState[]>([]);
  let wi = $state(0);
  let status = $state<'idle' | 'running' | 'done'>('idle');
  let notice = $state<string | undefined>(undefined);
  let showSublists = $state(false);
  let showCustom = $state(false);
  let showHudMenu = $state(false);
  let imeWarning = $state(false);

  // Timing & Live stats
  let startTime = $state(0);
  let lastKeystrokeMs = 0;
  let elapsed = $state(0);
  let liveWpm = $state(0);
  let liveRaw = $state(0);
  let liveAcc = $state(100);
  let keyClicksCount = $state(0);
  let correctKeys = 0;
  let totalKeys = 0;
  let intervalErrors = 0;
  let intervalKeys = 0;
  let samples: Sample[] = [];
  let keyStats: Record<string, KeyStat> = {};
  let eventLogs: KeyEventLog[] = [];
  let timerId: ReturnType<typeof setInterval> | null = null;
  let stream: WordStream | null = null;

  // Visual keyboard state
  let lastKeyPressed = $state<string | null>(null);
  let lastKeyOk = $state(true);

  // Results & Telemetry
  let lastResult = $state<TestResult | null>(null);
  let telemetry = $state<TelemetryReport | null>(null);
  let prevBest = $state<TestResult | null>(null);
  let isNewPb = $state(false);
  let hoveredAwl = $state<AwlEntry | null>(null);
  let sprint = $state<SprintState>(getSprintState());

  // DOM refs for scrolling & caret
  let wordsBoxEl = $state<HTMLElement | null>(null);
  let hiddenInputEl = $state<HTMLInputElement | null>(null);
  let lineOffset = $state(0);
  let tabPressed = false;

  const nextExpectedChar = $derived.by(() => {
    if (status === 'done' || !words[wi]) return null;
    const w = words[wi];
    if (w.typed.length < w.target.length) return w.target[w.typed.length];
    return ' ';
  });

  const timeRemaining = $derived(
    settings.mode === 'time' ? Math.max(0, Math.ceil(settings.time - elapsed)) : Math.floor(elapsed),
  );

  const wordsProgress = $derived(
    settings.mode === 'words' ? `${wi} / ${words.length}` : `${wi} words`,
  );

  function initTest() {
    stopTimer();
    status = 'idle';
    wi = 0;
    elapsed = 0;
    lastKeystrokeMs = 0;
    liveWpm = 0;
    liveRaw = 0;
    liveAcc = 100;
    keyClicksCount = 0;
    correctKeys = 0;
    totalKeys = 0;
    intervalErrors = 0;
    intervalKeys = 0;
    samples = [];
    keyStats = {};
    eventLogs = [];
    lastResult = null;
    telemetry = null;
    hoveredAwl = null;
    lineOffset = 0;
    lastKeyPressed = null;

    const created = createStream(settings);
    stream = created.stream;
    notice = created.notice;

    const initialCount = settings.mode === 'words' ? settings.words : 90;
    words = stream.next(initialCount).map((t) => ({ target: t, typed: '', done: false }));
    void tick().then(() => focusInput());
  }

  function focusInput() {
    hiddenInputEl?.focus();
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function startTimer() {
    const now = performance.now();
    startTime = now;
    lastKeystrokeMs = now;
    status = 'running';
    let lastSec = 0;
    timerId = setInterval(() => {
      const curNow = performance.now();
      elapsed = (curNow - startTime) / 1000;
      const mins = Math.max(elapsed / 60, 1 / 60);
      liveWpm = Math.round(correctKeys / 5 / mins);
      liveRaw = Math.round(totalKeys / 5 / mins);
      liveAcc = totalKeys > 0 ? Math.round((correctKeys / totalKeys) * 100) : 100;

      const sec = Math.floor(elapsed);
      if (sec > lastSec) {
        lastSec = sec;
        const secRaw = Math.round((intervalKeys / 5) * 60);
        samples.push({ wpm: liveWpm, raw: secRaw, err: intervalErrors });
        intervalKeys = 0;
        intervalErrors = 0;
      }

      if (settings.mode === 'time' && elapsed >= settings.time) {
        finishTest();
      }
    }, 100);
  }

  function computeConsistency(s: Sample[]): number {
    if (s.length < 2) return 100;
    const vals = s.map((x) => x.raw);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (mean <= 0) return 100;
    const variance = vals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / vals.length;
    const sd = Math.sqrt(variance);
    return Math.max(0, Math.min(100, Math.round(100 - (sd / mean) * 65)));
  }

  function finishTest() {
    stopTimer();
    if (status === 'done') return;
    status = 'done';
    const dur = settings.mode === 'time' ? settings.time : Math.max(1, (performance.now() - startTime) / 1000);

    let cCorrect = 0;
    let cIncorrect = 0;
    let cExtra = 0;
    let cMissed = 0;
    const missedWords = new Set<string>();

    const upto = Math.min(wi + 1, words.length);
    for (let i = 0; i < upto; i++) {
      const w = words[i];
      if (!w.done && w.typed.length === 0) continue;
      let wordPerfect = w.typed === w.target;
      const len = Math.max(w.target.length, w.typed.length);
      for (let c = 0; c < len; c++) {
        const tc = w.target[c];
        const uc = w.typed[c];
        if (tc !== undefined && uc !== undefined) {
          if (tc === uc) cCorrect++;
          else {
            cIncorrect++;
            wordPerfect = false;
          }
        } else if (uc !== undefined) {
          cExtra++;
          wordPerfect = false;
        } else if (w.done) {
          cMissed++;
          wordPerfect = false;
        }
      }
      if (w.done && wordPerfect) cCorrect++; // count space
      if (!wordPerfect) {
        const clean = w.target.toLowerCase().replace(/[^a-z-]/g, '');
        if (clean) missedWords.add(clean);
      }
    }

    const mins = dur / 60;
    const finalWpm = Math.round(cCorrect / 5 / mins);
    const finalRaw = Math.round(totalKeys / 5 / mins);
    const finalAcc = totalKeys > 0 ? Math.round((correctKeys / totalKeys) * 100) : 100;

    if (samples.length === 0) {
      samples.push({ wpm: finalWpm, raw: finalRaw, err: cIncorrect + cExtra });
    }

    // Run sequencing, timing, transposition, and delete-trigger telemetry analysis
    const report = analyzeKeystrokeTelemetry(eventLogs);
    telemetry = report;

    const limit = settings.mode === 'time' ? settings.time : settings.mode === 'words' ? settings.words : 0;
    const res: TestResult = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date: Date.now(),
      mode: settings.mode,
      limit,
      source: settings.source,
      punctuation: settings.source === 'sprint' ? false : settings.punctuation,
      unranked: settings.source === 'sprint' ? true : undefined,
      wpm: finalWpm,
      raw: finalRaw,
      acc: finalAcc,
      consistency: computeConsistency(samples),
      duration: Math.round(dur),
      chars: { correct: cCorrect, incorrect: cIncorrect, extra: cExtra, missed: cMissed },
      samples: [...samples],
      keys: { ...keyStats },
      missed: [...missedWords],
      transpositions: report.transpositions.map((t) => t.pair),
      deleteTriggers: report.deleteTriggers.map((d) => d.trigger),
      slowestKeys: report.hesitationKeys.slice(0, 4).map((h) => ({ key: h.key, avgMs: h.avgMs })),
    };

    if (res.unranked || res.source === 'sprint') {
      prevBest = null;
      isNewPb = res.wpm > 0 && res.wpm > sprint.bestWpm;
      saveResult(res);
      sprint = getSprintState();
      if (sprint.tokens <= 0) {
        settings.source = 'mixed';
      }
    } else {
      prevBest = bestFor(res);
      isNewPb = !prevBest || res.wpm > prevBest.wpm;
      saveResult(res);
      sprint = getSprintState();
    }
    lastResult = res;

    // Default inspect first missed AWL word or the first AWL word in the test
    for (let i = 0; i < upto; i++) {
      const clean = words[i].target.toLowerCase().replace(/[^a-z-]/g, '');
      const entry = lookupAwl(clean);
      if (entry) {
        hoveredAwl = entry;
        break;
      }
    }
  }

  function recordKey(expected: string, typed: string, ok: boolean, word: string, charIdx: number) {
    const now = performance.now();
    const dt = lastKeystrokeMs ? Math.max(1, now - lastKeystrokeMs) : 0;
    lastKeystrokeMs = now;

    eventLogs.push({
      t: now - startTime,
      dt,
      expected,
      typed,
      ok,
      word,
      charIdx,
    });

    const targetKey = (expected || typed).toLowerCase() === ' ' ? 'space' : (expected || typed).toLowerCase();
    const cur = keyStats[targetKey] ?? { n: 0, e: 0, ms: 0, del: 0 };
    cur.n++;
    if (!ok) cur.e++;
    if (dt > 0 && dt < 2500) cur.ms = (cur.ms ?? 0) + Math.round(dt);
    keyStats[targetKey] = cur;

    lastKeyPressed = typed;
    lastKeyOk = ok;
  }

  function recordBackspace(word: string, charIdx: number) {
    const now = performance.now();
    const dt = lastKeystrokeMs ? Math.max(1, now - lastKeystrokeMs) : 0;
    lastKeystrokeMs = now;

    // Credit delete count to the most recent forward keystroke
    for (let i = eventLogs.length - 1; i >= 0; i--) {
      if (eventLogs[i].typed !== 'BACK') {
        const causeKey =
          (eventLogs[i].expected || eventLogs[i].typed).toLowerCase() === ' '
            ? 'space'
            : (eventLogs[i].expected || eventLogs[i].typed).toLowerCase();
        if (keyStats[causeKey]) {
          keyStats[causeKey].del = (keyStats[causeKey].del ?? 0) + 1;
        }
        break;
      }
    }

    eventLogs.push({
      t: now - startTime,
      dt,
      expected: 'BACK',
      typed: 'BACK',
      ok: true,
      word,
      charIdx,
    });
  }

  function scrollLinesIfNeeded() {
    if (!wordsBoxEl) return;
    const activeEl = wordsBoxEl.querySelector(`.word[data-i="${wi}"]`) as HTMLElement | null;
    if (!activeEl) return;
    // Keep the active word on the top visible row so the 2nd visible row is always look-ahead
    lineOffset = activeEl.offsetTop;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.isComposing || e.keyCode === 229) {
      imeWarning = true;
      return;
    }
    imeWarning = false;

    if (e.key === 'Tab') {
      e.preventDefault();
      tabPressed = true;
      setTimeout(() => (tabPressed = false), 900);
      return;
    }
    if (e.key === 'Enter' && (tabPressed || status === 'done')) {
      e.preventDefault();
      tabPressed = false;
      initTest();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (status === 'running' && settings.mode === 'zen') {
        finishTest();
      } else {
        initTest();
      }
      return;
    }

    if (status === 'done') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    // Ignore events when typing inside custom text / alias inputs
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'TEXTAREA' || (tag === 'INPUT' && e.target !== hiddenInputEl)) {
      return;
    }

    const cur = words[wi];
    if (!cur) return;

    if (e.key === 'Backspace') {
      e.preventDefault();
      if (cur.typed.length > 0) {
        recordBackspace(cur.target, cur.typed.length - 1);
        cur.typed = cur.typed.slice(0, -1);
        keyClicksCount++;
        if (settings.sound) playClick(settings.soundPack, settings.volume, 'back');
      } else if (wi > 0 && words[wi - 1].typed !== words[wi - 1].target) {
        wi--;
        words[wi].done = false;
        recordBackspace(words[wi].target, words[wi].typed.length);
        if (settings.sound) playClick(settings.soundPack, settings.volume, 'back');
        scrollLinesIfNeeded();
      }
      return;
    }

    if (e.key === ' ') {
      e.preventDefault();
      if (cur.typed.length === 0) return;
      if (settings.strictSpace && cur.typed !== cur.target) {
        if (settings.sound && settings.errorSound) playClick(settings.soundPack, settings.volume, 'error');
        return;
      }
      if (status === 'idle') startTimer();

      const ok = cur.typed === cur.target;
      totalKeys++;
      intervalKeys++;
      keyClicksCount++;
      if (ok) correctKeys++;
      else intervalErrors++;
      recordKey(' ', ' ', ok, cur.target, cur.typed.length);

      if (settings.sound) {
        playClick(settings.soundPack, settings.volume, ok || !settings.errorSound ? 'space' : 'error');
      }

      cur.done = true;
      wi++;

      // Replenish endless streams
      if (settings.mode !== 'words' && stream && !stream.finite && words.length - wi < 45) {
        const more = stream.next(50).map((t) => ({ target: t, typed: '', done: false }));
        words.push(...more);
      }

      if (wi >= words.length) {
        finishTest();
        return;
      }
      void tick().then(scrollLinesIfNeeded);
      return;
    }

    if (e.key.length === 1) {
      e.preventDefault();
      if (status === 'idle') startTimer();

      const idx = cur.typed.length;
      const expected = cur.target[idx] ?? '';
      const ok = expected === e.key;

      totalKeys++;
      intervalKeys++;
      keyClicksCount++;
      if (ok) {
        correctKeys++;
      } else {
        intervalErrors++;
      }
      recordKey(expected, e.key, ok, cur.target, idx);

      if (settings.sound) {
        playClick(settings.soundPack, settings.volume, ok || !settings.errorSound ? 'key' : 'error');
      }

      if (!ok && settings.stopOnError) {
        return;
      }

      if (cur.typed.length < cur.target.length + 12) {
        cur.typed += e.key;
      }

      // Auto-finish on last character of last word in words mode
      if (settings.mode === 'words' && wi === words.length - 1 && cur.typed === cur.target) {
        cur.done = true;
        finishTest();
      }
    }
  }

  function setMode(m: Mode) {
    settings.mode = m;
    initTest();
  }
  function setSource(s: Source) {
    if (s === 'awl') {
      if (settings.source === 'sentences') settings.source = 'sentences_awl';
      else if (settings.source === 'sentences_awl') settings.source = 'sentences';
      else settings.source = 'awl';
    } else if (s === 'sentences') {
      if (settings.source === 'awl') settings.source = 'sentences_awl';
      else if (settings.source === 'sentences_awl') settings.source = 'awl';
      else settings.source = 'sentences';
    } else if (s === 'sprint') {
      if (sprint.tokens <= 0 && settings.source !== 'sprint') return;
      settings.source = 'sprint';
    } else {
      settings.source = s;
    }
    if (settings.source === 'custom') showCustom = true;
    initTest();
  }
  function toggleSublist(n: number) {
    if (settings.sublists.includes(n)) {
      if (settings.sublists.length > 1) {
        settings.sublists = settings.sublists.filter((x) => x !== n);
      }
    } else {
      settings.sublists = [...settings.sublists, n].sort((a, b) => a - b);
    }
    initTest();
  }

  function drillDiagnosticWords(wordList: string[]) {
    const clean = wordList.filter(Boolean);
    if (!clean.length) return;
    const repeated: string[] = [];
    for (let i = 0; i < 30; i++) {
      repeated.push(clean[i % clean.length]);
    }
    settings.source = 'custom';
    settings.customText = repeated.join(' ');
    settings.mode = 'words';
    settings.words = 25;
    initTest();
  }

  function speakWord(w: string) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(w);
      u.lang = 'en-US';
      u.rate = 0.92;
      window.speechSynthesis.speak(u);
    }
  }

  onMount(() => {
    sprint = getSprintState();
    if (settings.source === 'sprint' && sprint.tokens <= 0) {
      settings.source = 'mixed';
    }
    initTest();
  });
  onDestroy(() => {
    stopTimer();
  });

  // Collect AWL words present in the test for vocabulary review
  const testAwlWords = $derived.by(() => {
    if (status !== 'done') return [];
    const seen = new Map<string, { entry: AwlEntry; missed: boolean; typedOk: boolean }>();
    const upto = Math.min(wi + 1, words.length);
    for (let i = 0; i < upto; i++) {
      const w = words[i];
      if (!w.done && w.typed.length === 0) continue;
      const clean = w.target.toLowerCase().replace(/[^a-z-]/g, '');
      const entry = lookupAwl(clean);
      if (entry && !seen.has(entry.w)) {
        const isPerfect = w.done && w.typed === w.target;
        const isMistyped = w.done && w.typed !== w.target;
        seen.set(entry.w, { entry, missed: isMistyped, typedOk: isPerfect });
      }
    }
    return [...seen.values()];
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<section class="typing-page">
  <!-- Mode & Word Source Toolbar -->
  <div class="toolbar card">
    <div class="group">
      <button
        class:on={settings.punctuation}
        onclick={() => {
          settings.punctuation = !settings.punctuation;
          initTest();
        }}
        title="Add capital letters and punctuation"
      >
        @ punctuation
      </button>
      <button
        class:on={settings.families}
        onclick={() => {
          settings.families = !settings.families;
          initTest();
        }}
        title="Include derived word forms from AWL families"
      >
        # word families
      </button>
    </div>

    <span class="sep"></span>

    <div class="group">
      <button class:on={settings.mode === 'time'} onclick={() => setMode('time')}>time</button>
      <button class:on={settings.mode === 'words'} onclick={() => setMode('words')}>words</button>
      <button class:on={settings.mode === 'zen'} onclick={() => setMode('zen')}>zen</button>
    </div>

    {#if settings.mode === 'time'}
      <span class="sep"></span>
      <div class="group">
        {#each [15, 30, 60, 120] as t}
          <button
            class:on={settings.time === t}
            onclick={() => {
              settings.time = t;
              initTest();
            }}>{t}s</button
          >
        {/each}
      </div>
    {:else if settings.mode === 'words'}
      <span class="sep"></span>
      <div class="group">
        {#each [10, 25, 50, 100] as c}
          <button
            class:on={settings.words === c}
            onclick={() => {
              settings.words = c;
              initTest();
            }}>{c}</button
          >
        {/each}
      </div>
    {/if}

    <span class="sep"></span>

    <div class="group">
      <button class:on={settings.source === 'mixed'} onclick={() => setSource('mixed')}>mixed AWL</button>
      <button
        class:on={settings.source === 'awl' || settings.source === 'sentences_awl'}
        onclick={() => setSource('awl')}
        title="Academic Word List (combine with sentences for AWL sentences)"
      >AWL 570</button>
      <button
        class:on={settings.source === 'sentences' || settings.source === 'sentences_awl'}
        onclick={() => setSource('sentences')}
        title="Academic sentences (combine with AWL 570 to filter by selected sublists)"
      >sentences</button>
      <button class:on={settings.source === 'common200'} onclick={() => setSource('common200')}>top 200</button>
      <button class:on={settings.source === 'common1000'} onclick={() => setSource('common1000')}>top 1k</button>
      <button class:on={settings.source === 'weak'} onclick={() => setSource('weak')}>weak words</button>
      <button class:on={settings.source === 'custom'} onclick={() => setSource('custom')}>custom</button>
      <button
        class:on={settings.source === 'sprint'}
        disabled={sprint.tokens <= 0 && settings.source !== 'sprint'}
        onclick={() => setSource('sprint')}
        title={`Unranked short-word sprint (${sprint.completedCount % SPRINT_RUNS_PER_TOKEN}/${SPRINT_RUNS_PER_TOKEN} ranked runs toward next token, max ${SPRINT_MAX_TOKENS})`}
      >⚡ sprint ({sprint.tokens}/{SPRINT_MAX_TOKENS})</button>
    </div>

    <span class="sep"></span>

    <div class="group">
      {#if settings.source === 'awl' || settings.source === 'mixed' || settings.source === 'sentences_awl'}
        <button class:on={showSublists} onclick={() => (showSublists = !showSublists)}>
          sublists ({settings.sublists.length}/10)
        </button>
      {/if}
      <button class:on={showHudMenu} onclick={() => (showHudMenu = !showHudMenu)}>
        ⚙ HUD & sound
      </button>
    </div>
  </div>

  <!-- Sublist & Ratio Drawer -->
  {#if showSublists && (settings.source === 'awl' || settings.source === 'mixed' || settings.source === 'sentences_awl')}
    <div class="drawer card">
      <div class="drawer-row">
        <span class="sub">Coxhead AWL Sublists:</span>
        <div class="sublist-pills">
          {#each [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as n}
            <button class="pill" class:on={settings.sublists.includes(n)} onclick={() => toggleSublist(n)}>
              Sublist {n}
            </button>
          {/each}
          <button
            class="pill ghost"
            onclick={() => {
              settings.sublists = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
              initTest();
            }}>All</button
          >
        </div>
      </div>
      {#if settings.source === 'mixed'}
        <div class="drawer-row">
          <label class="sub" for="awl-ratio"
            >AWL Ratio: <b>{settings.awlRatio}%</b> AWL / {100 - settings.awlRatio}% common</label
          >
          <input
            id="awl-ratio"
            type="range"
            min="10"
            max="90"
            step="10"
            bind:value={settings.awlRatio}
            onchange={initTest}
          />
        </div>
      {/if}
    </div>
  {/if}

  <!-- Custom Text Drawer -->
  {#if showCustom || settings.source === 'custom'}
    <div class="drawer card">
      <label class="sub" for="custom-txt">Custom practice text (paste a TOEFL reading paragraph or model essay):</label>
      <textarea
        id="custom-txt"
        rows="3"
        bind:value={settings.customText}
        placeholder="Paste or type custom text here..."
      ></textarea>
      <div class="drawer-actions">
        <button
          class="btn primary"
          onclick={() => {
            showCustom = false;
            initTest();
          }}>Apply & Restart</button
        >
      </div>
    </div>
  {/if}

  <!-- HUD, Sound & Behaviour Options Drawer -->
  {#if showHudMenu}
    <div class="drawer card hud-grid">
      <div>
        <h4>Live HUD Toggles</h4>
        <label class="toggle">
          <input type="checkbox" bind:checked={settings.showWpm} />
          <span>Real-time speed (WPM)</span>
        </label>
        <label class="toggle">
          <input type="checkbox" bind:checked={settings.showTime} />
          <span>Time / words remaining</span>
        </label>
        <label class="toggle">
          <input type="checkbox" bind:checked={settings.showAccuracy} />
          <span>Live accuracy & keystroke counter</span>
        </label>
        <label class="toggle">
          <input type="checkbox" bind:checked={settings.showKeyboard} />
          <span>On-screen keyboard guide</span>
        </label>
      </div>

      <div>
        <h4>Key Click Sound (8 Profiles)</h4>
        <label class="toggle">
          <input type="checkbox" bind:checked={settings.sound} />
          <span>Audible key clicks</span>
        </label>
        <label class="toggle">
          <input type="checkbox" bind:checked={settings.errorSound} disabled={!settings.sound} />
          <span>Distinct error tone</span>
        </label>
        <div class="pack-row">
          {#each SOUND_PACKS as pack}
            <button
              class="pill"
              class:on={settings.soundPack === pack.id}
              title={pack.desc}
              onclick={() => {
                settings.soundPack = pack.id as SoundPack;
                playClick(settings.soundPack, settings.volume, 'key');
              }}>{pack.label}</button
            >
          {/each}
        </div>
        <div class="pack-row">
          <label class="sub" for="vol-range">Volume: {settings.volume}%</label>
          <input id="vol-range" type="range" min="0" max="100" step="5" bind:value={settings.volume} />
        </div>
      </div>

      <div>
        <h4>Typing Rules & Machine Tag</h4>
        <label class="toggle">
          <input type="checkbox" bind:checked={settings.stopOnError} />
          <span>Stop on error (must type correct key)</span>
        </label>
        <label class="toggle">
          <input type="checkbox" bind:checked={settings.strictSpace} />
          <span>Strict space (must fix word before advancing)</span>
        </label>
        <label class="toggle">
          <input type="checkbox" bind:checked={settings.cloudSync} />
          <span>Sync scores to shared leaderboard</span>
        </label>
        <div class="pack-row">
          <span class="sub">Machine ID: <b>{settings.machineAlias}</b></span>
          <button class="pill" onclick={rerollWatchAlias} title="Generate another watch-brand ID">↻ Re-roll</button>
        </div>
      </div>
    </div>
  {/if}

  {#if notice}
    <div class="notice">{notice}</div>
  {/if}
  {#if imeWarning}
    <div class="notice warn">
      IME input detected. Please switch your keyboard to direct English (ABC / Alphanumeric) mode.
    </div>
  {/if}

  <!-- Quick HUD Toggle Strip -->
  <div class="hud-bar">
    <div class="live-metrics">
      {#if settings.showTime}
        <div class="metric">
          <span class="val accent">
            {#if settings.mode === 'time'}
              {timeRemaining}s
            {:else}
              {wordsProgress}
            {/if}
          </span>
          <span class="lbl">{settings.mode === 'time' ? 'remaining' : 'progress'}</span>
        </div>
      {/if}
      {#if settings.showWpm}
        <div class="metric">
          <span class="val">{status === 'idle' ? '—' : liveWpm}</span>
          <span class="lbl">wpm</span>
        </div>
      {/if}
      {#if settings.showAccuracy}
        <div class="metric">
          <span class="val">{status === 'idle' ? '100%' : `${liveAcc}%`}</span>
          <span class="lbl">acc ({keyClicksCount} keys)</span>
        </div>
      {/if}
    </div>

    {#if status === 'done'}
      <div class="hud-center">
        <button class="btn primary restart-mid-btn" onclick={initTest} title="Start next typing test (Enter or Tab+Enter)">
          ↻ Restart Test
        </button>
      </div>
    {/if}

    <div class="quick-toggles">
      <a class="chip alias-chip" href="#/stats" title="Your machine watch-brand alias on the shared leaderboard">
        ⌚ {settings.machineAlias}
      </a>
      <button
        class="chip"
        class:on={settings.showWpm}
        onclick={() => (settings.showWpm = !settings.showWpm)}
        title="Toggle real-time WPM display"
      >
        Speed: {settings.showWpm ? 'ON' : 'OFF'}
      </button>
      <button
        class="chip"
        class:on={settings.showTime}
        onclick={() => (settings.showTime = !settings.showTime)}
        title="Toggle time remaining display"
      >
        Timer: {settings.showTime ? 'ON' : 'OFF'}
      </button>
      <button
        class="chip"
        class:on={settings.sound}
        onclick={() => {
          settings.sound = !settings.sound;
          if (settings.sound) playClick(settings.soundPack, settings.volume, 'key');
        }}
        title="Toggle key click sound"
      >
        Key Clicks: {settings.sound ? settings.soundPack : 'OFF'}
      </button>
    </div>
  </div>

  {#if status !== 'done'}
    <!-- Active Typing Area -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="typing-arena"
      onclick={focusInput}
      style="--font-active: var(--font-{settings.font}); font-size: {settings.fontSize / 10}rem;"
    >
      <input
        bind:this={hiddenInputEl}
        class="sr-only"
        type="text"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        aria-label="Typing input"
      />

      <div class="words-viewport" bind:this={wordsBoxEl}>
        <div class="words-flow" style="transform: translateY(-{lineOffset}px)">
          {#each words as w, i}
            {@const isCurrent = i === wi}
            {@const hasError = w.done && w.typed !== w.target}
            <span class="word" class:current={isCurrent} class:error={hasError} data-i={i}>
              {#each w.target.split('') as ch, ci}
                {@const typedCh = w.typed[ci]}
                {@const isCaret = isCurrent && w.typed.length === ci}
                <span
                  class="ch"
                  class:ok={typedCh !== undefined && typedCh === ch}
                  class:bad={typedCh !== undefined && typedCh !== ch}
                  class:caret={isCaret}
                >{ch}</span>
              {/each}{#if w.typed.length > w.target.length}{#each w.typed.slice(w.target.length).split('') as ex}<span class="ch extra">{ex}</span>{/each}{/if}{#if isCurrent && w.typed.length >= w.target.length}<span class="caret-end"></span>{/if}
            </span>
          {/each}
        </div>
      </div>
    </div>

    {#if settings.showKeyboard}
      <div class="kb-wrap">
        <Keyboard pressed={lastKeyPressed} pressedOk={lastKeyOk} next={nextExpectedChar} />
      </div>
    {/if}

    <div class="hints">
      <span><kbd>Tab</kbd> + <kbd>Enter</kbd> restart</span>
      <span><kbd>Esc</kbd> {settings.mode === 'zen' && status === 'running' ? 'finish zen' : 'reset'}</span>
    </div>
  {:else if lastResult}
    <!-- Results Screen -->
    <div class="results">
      {#if testAwlWords.length > 0}
        <div class="awl-review card">
          <div class="awl-header">
            <h3>Academic Word List (AWL) Vocabulary in This Test</h3>
            <span class="sub">Hover or click any word to inspect its definition, sublist, and word family</span>
          </div>
          <div class="awl-chips">
            {#each testAwlWords as item}
              <button
                class="awl-chip"
                class:typed-ok={item.typedOk}
                class:missed={item.missed}
                class:selected={hoveredAwl?.w === item.entry.w}
                onmouseenter={() => (hoveredAwl = item.entry)}
                onclick={() => (hoveredAwl = item.entry)}
              >
                {item.entry.w}
                <small>S{item.entry.s}</small>
              </button>
            {/each}
          </div>
          {#if hoveredAwl}
            <div class="awl-detail">
              <div class="awl-title">
                <b>{hoveredAwl.w}</b>
                <button class="pill" onclick={() => speakWord(hoveredAwl!.w)} title="Pronounce word">🔊 Speak</button>
                <span class="badge">Sublist {hoveredAwl.s}</span>
                {#if hoveredAwl.f.length}
                  <span class="family">Family: {hoveredAwl.f.join(', ')}</span>
                {/if}
              </div>
              <p class="def">{hoveredAwl.d}</p>
              <p class="ex">“{hoveredAwl.e}”</p>
            </div>
          {/if}
        </div>
      {/if}

      <div class="res-top">
        <div class="hero-stats card">
          <div class="big-stat">
            <span class="lbl">wpm {#if lastResult.unranked || lastResult.source === 'sprint'}<span class="pb-badge" title="Unranked sprint — not posted to leaderboard">UNRANKED SPRINT</span>{/if}{#if isNewPb}<span class="pb-badge">NEW PB</span>{/if}</span>
            <span class="big accent">{lastResult.wpm}</span>
          </div>
          <div class="big-stat">
            <span class="lbl">accuracy</span>
            <span class="big">{lastResult.acc}%</span>
          </div>
          <div class="mini-grid">
            <div>
              <span class="lbl">raw wpm</span>
              <b>{lastResult.raw}</b>
            </div>
            <div>
              <span class="lbl">consistency</span>
              <b>{lastResult.consistency}%</b>
            </div>
            <div>
              <span class="lbl">characters</span>
              <b title="correct / incorrect / extra / missed">
                {lastResult.chars.correct}/{lastResult.chars.incorrect}/{lastResult.chars.extra}/{lastResult.chars.missed}
              </b>
            </div>
            <div>
              <span class="lbl">median key pace</span>
              <b>{telemetry?.medianIkiMs ?? '—'}ms</b>
            </div>
          </div>
        </div>

        <div class="chart-card card">
          <LineChart
            series={[
              { values: (lastResult.samples ?? []).map((s) => s.wpm), color: 'var(--accent)', label: 'Net WPM', width: 3 },
              {
                values: (lastResult.samples ?? []).map((s) => s.raw),
                color: 'var(--sub)',
                label: 'Raw WPM',
                width: 2,
                dashed: true,
              },
            ]}
            markers={(lastResult.samples ?? []).map((s) => s.err)}
            xLabel={(i) => `${i + 1}s`}
            yLabel="WPM"
          />
        </div>
      </div>

      <!-- Timing, Sequencing, Transposition & Backspace Coach -->
      {#if telemetry}
        <div class="coach-card card">
          <div class="coach-head">
            <div>
              <h3>Timing, Sequencing & Error Diagnostics Coach</h3>
              <span class="sub">
                Baseline cadence: <b>{telemetry.medianIkiMs}ms</b> median key interval (90th percentile:
                <b>{telemetry.p90IkiMs}ms</b>)
              </span>
            </div>
            {#if telemetry.recommendedDrillWords.length > 0}
              <button class="btn primary" onclick={() => drillDiagnosticWords(telemetry!.recommendedDrillWords)}>
                Drill My {telemetry.recommendedDrillWords.length} Problem Words →
              </button>
            {/if}
          </div>

          {#if telemetry.findings.length === 0}
            <p class="good-clean">
              Clean run! No key-order transpositions, backspace bursts, or major key-finding hesitations detected.
            </p>
          {:else}
            <div class="findings-grid">
              {#each telemetry.findings as f}
                <div class="finding-box" class:high={f.severity === 'high'}>
                  <div class="finding-title">
                    <b>{f.title}</b>
                    <span class="sev-pill {f.severity}">{f.severity}</span>
                  </div>
                  <p class="finding-sum">{f.summary}</p>
                  <div class="finding-examples">
                    {#each f.examples as ex}
                      <span class="ex-chip">{ex}</span>
                    {/each}
                  </div>
                  <p class="finding-tip"><b>Prevention:</b> {f.preventionTip}</p>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <div class="res-actions">
        <button class="btn primary" onclick={initTest}>Next Test (Tab + Enter)</button>
        <a class="btn" href="#/stats">Shared Leaderboard & Key Latency Map</a>
      </div>
    </div>
  {/if}
</section>

<style>
  .typing-page {
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.4rem 0.75rem;
    padding: 0.65rem 1rem;
    font-size: 0.9rem;
  }
  .group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  .toolbar button {
    background: none;
    border: none;
    color: var(--sub);
    padding: 0.3rem 0.55rem;
    border-radius: 6px;
    transition: color 0.15s, background 0.15s;
  }
  .toolbar button:hover {
    color: var(--text);
  }
  .toolbar button.on {
    color: var(--accent);
    background: var(--bg-3);
    font-weight: 600;
  }
  .sep {
    width: 2px;
    height: 1.2rem;
    background: var(--border);
  }
  .drawer {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    font-size: 0.9rem;
  }
  .drawer-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
  }
  .sublist-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .pill {
    background: var(--bg-3);
    border: 1px solid var(--border);
    color: var(--sub);
    padding: 0.25rem 0.6rem;
    border-radius: 6px;
    font-size: 0.82rem;
  }
  .pill.on {
    border-color: var(--accent);
    color: var(--accent);
  }
  textarea {
    width: 100%;
    background: var(--bg);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.6rem;
    font-family: var(--font-mono);
  }
  .hud-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1.25rem;
  }
  .hud-grid h4 {
    margin: 0 0 0.5rem;
    color: var(--accent);
    font-size: 0.9rem;
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0.35rem 0;
    color: var(--text);
    cursor: pointer;
  }
  .pack-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.45rem;
  }
  .notice {
    text-align: center;
    font-size: 0.9rem;
    color: var(--sub);
    background: var(--bg-2);
    border: 1px solid var(--border);
    padding: 0.5rem 0.9rem;
    border-radius: 8px;
  }
  .notice.warn {
    border-color: var(--bad);
    color: var(--bad);
  }
  .hud-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
    min-height: 3.4rem;
    padding: 0 0.25rem;
  }
  .hud-center {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .restart-mid-btn {
    padding: 0.45rem 1.2rem;
    font-size: 0.95rem;
    border-radius: 999px;
    box-shadow: 0 2px 10px rgba(245, 185, 66, 0.22);
  }
  .live-metrics {
    display: flex;
    gap: 2rem;
    align-items: baseline;
  }
  .metric {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
  }
  .metric .val {
    font-family: var(--font-mono);
    font-size: 2rem;
    font-weight: 700;
    color: var(--text);
  }
  .metric .val.accent {
    color: var(--accent);
  }
  .metric .lbl {
    font-size: 0.8rem;
    color: var(--muted);
  }
  .quick-toggles {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .chip {
    background: var(--bg-2);
    border: 1px solid var(--border);
    color: var(--muted);
    padding: 0.3rem 0.65rem;
    border-radius: 999px;
    font-size: 0.78rem;
    text-decoration: none;
  }
  .chip.on {
    color: var(--text);
    border-color: var(--accent);
  }
  .alias-chip {
    color: var(--accent);
    border-color: var(--border);
    font-family: var(--font-mono);
  }
  .typing-arena {
    position: relative;
    font-family: var(--font-active, var(--font-mono));
    padding: 1.5rem 1.25rem;
    border-radius: 12px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    cursor: text;
    user-select: none;
  }
  .words-viewport {
    --line-h: 1.85em;
    height: calc(var(--line-h) * 2);
    overflow: hidden;
    position: relative;
  }
  .words-flow {
    display: flex;
    flex-wrap: wrap;
    gap: 0 0.55em;
    line-height: var(--line-h);
    transition: transform 0.16s var(--ease);
  }
  .word {
    position: relative;
    height: var(--line-h);
    display: inline-flex;
    align-items: center;
    color: var(--muted);
    border-bottom: 2px solid transparent;
  }
  .word.error {
    border-bottom-color: var(--bad);
  }
  .ch.ok {
    color: var(--text);
  }
  .ch.bad {
    color: var(--bad);
  }
  .ch.extra {
    color: var(--bad-dim);
  }
  .ch.caret {
    position: relative;
  }
  .ch.caret::before,
  .caret-end::before {
    content: '';
    position: absolute;
    left: -1px;
    top: 6px;
    bottom: 6px;
    width: 2.5px;
    background: var(--accent);
    border-radius: 2px;
    animation: blink 1s infinite;
  }
  .caret-end {
    position: relative;
    display: inline-block;
    width: 0;
    height: 1em;
  }
  @keyframes blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.2;
    }
  }
  .kb-wrap {
    margin-top: 0.25rem;
  }
  .hints {
    display: flex;
    justify-content: center;
    gap: 1.5rem;
    font-size: 0.82rem;
    color: var(--muted);
  }
  .results {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .res-top {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 1.25rem;
  }
  @media (max-width: 820px) {
    .res-top {
      grid-template-columns: 1fr;
    }
  }
  .hero-stats {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 1rem;
  }
  .big-stat .lbl {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--sub);
    font-size: 0.9rem;
  }
  .big-stat .big {
    font-family: var(--font-mono);
    font-size: 3.4rem;
    font-weight: 700;
    line-height: 1.05;
  }
  .big-stat .big.accent {
    color: var(--accent);
  }
  .pb-badge {
    background: var(--accent);
    color: var(--bg);
    font-size: 0.68rem;
    font-weight: 700;
    padding: 0.1rem 0.45rem;
    border-radius: 4px;
  }
  .mini-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.65rem;
    font-size: 0.85rem;
  }
  .mini-grid .lbl {
    display: block;
    color: var(--muted);
    font-size: 0.75rem;
  }
  .mini-grid b {
    font-family: var(--font-mono);
    color: var(--text);
  }
  .chart-card {
    display: flex;
    align-items: center;
  }

  /* Coach & Telemetry Styles */
  .coach-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 0.9rem;
  }
  .coach-head h3 {
    margin: 0 0 0.2rem;
    font-size: 1.05rem;
  }
  .good-clean {
    margin: 0;
    color: var(--good);
    font-weight: 600;
  }
  .findings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 0.9rem;
  }
  .finding-box {
    background: var(--bg);
    border: 1px solid var(--border);
    border-left: 4px solid var(--accent);
    border-radius: 8px;
    padding: 0.9rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }
  .finding-box.high {
    border-left-color: var(--bad);
  }
  .finding-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.92rem;
  }
  .sev-pill {
    font-size: 0.7rem;
    text-transform: uppercase;
    font-weight: 700;
    padding: 0.1rem 0.45rem;
    border-radius: 4px;
    background: var(--bg-3);
    color: var(--sub);
  }
  .sev-pill.high {
    background: var(--bad);
    color: var(--bg);
  }
  .finding-sum {
    margin: 0;
    font-size: 0.85rem;
    color: var(--sub);
    line-height: 1.45;
  }
  .finding-examples {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .ex-chip {
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 0.2rem 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--text);
  }
  .finding-tip {
    margin: 0;
    font-size: 0.84rem;
    color: var(--text);
    line-height: 1.45;
  }

  .awl-review h3 {
    margin: 0;
    font-size: 1rem;
  }
  .awl-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }
  .awl-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .awl-chip {
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.3rem 0.6rem;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    color: var(--text);
  }
  .awl-chip small {
    color: var(--muted);
    margin-left: 0.25rem;
  }
  .awl-chip.typed-ok {
    border-color: color-mix(in srgb, var(--accent-2) 55%, var(--border));
    color: var(--accent-2);
  }
  .awl-chip.missed {
    border-color: var(--bad);
    color: var(--bad);
  }
  .awl-chip.selected {
    border-color: var(--accent);
    background: var(--bg);
    color: var(--accent);
  }
  .awl-detail {
    margin-top: 0.85rem;
    padding-top: 0.85rem;
    border-top: 1px solid var(--border);
  }
  .awl-title {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.6rem;
  }
  .awl-title b {
    font-size: 1.1rem;
    color: var(--accent);
  }
  .badge {
    background: var(--bg-3);
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    color: var(--sub);
  }
  .family {
    font-size: 0.82rem;
    color: var(--sub);
    font-family: var(--font-mono);
  }
  .def {
    margin: 0.4rem 0 0.25rem;
  }
  .ex {
    margin: 0;
    color: var(--sub);
    font-style: italic;
  }
  .res-actions {
    display: flex;
    justify-content: center;
    gap: 0.8rem;
  }
</style>
