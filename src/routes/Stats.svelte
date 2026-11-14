<script lang="ts">
  import { onMount } from 'svelte';
  import {
    getHistory,
    getKeyStats,
    getWeakWords,
    getCachedCloudScores,
    fetchCloudScores,
    exportAll,
    importAll,
    resetAll,
    type TestResult,
    type SharedScoreEntry,
  } from '../lib/storage';
  import { lookupAwl } from '../lib/words';
  import { settings, rerollWatchAlias, WATCH_BRANDS } from '../lib/settings.svelte';
  import LineChart from '../components/LineChart.svelte';
  import Keyboard from '../components/Keyboard.svelte';

  let history = $state<TestResult[]>(getHistory());
  let keys = $state(getKeyStats());
  let weak = $state(getWeakWords());
  let cloudScores = $state<SharedScoreEntry[]>(getCachedCloudScores());
  let loadingCloud = $state(false);
  let boardFilter = $state<'all' | 'time-30' | 'time-60' | 'words-25'>('all');
  let heatMode = $state<'error' | 'latency' | 'deletes'>('error');
  let msg = $state('');

  async function refreshCloud() {
    loadingCloud = true;
    cloudScores = await fetchCloudScores();
    loadingCloud = false;
  }

  function refresh() {
    history = getHistory();
    keys = getKeyStats();
    weak = getWeakWords();
    void refreshCloud();
  }

  onMount(() => {
    void refreshCloud();
  });

  const filteredCloudScores = $derived.by(() => {
    let list = [...cloudScores];
    if (boardFilter === 'time-30') list = list.filter((s) => s.mode === 'time' && s.limit === 30);
    else if (boardFilter === 'time-60') list = list.filter((s) => s.mode === 'time' && s.limit === 60);
    else if (boardFilter === 'words-25') list = list.filter((s) => s.mode === 'words' && s.limit === 25);
    return list.sort((a, b) => b.wpm - a.wpm || b.acc - a.acc).slice(0, 25);
  });

  const totalTests = $derived(history.length);
  const totalSecs = $derived(history.reduce((a, r) => a + (r.duration || 0), 0));
  const bestWpm = $derived(history.reduce((m, r) => Math.max(m, r.wpm), 0));
  const avgWpm = $derived.by(() => {
    const recent = history.slice(-20);
    if (!recent.length) return 0;
    return Math.round(recent.reduce((a, r) => a + r.wpm, 0) / recent.length);
  });

  // Aggregate slow-find keys & delete triggers across all history
  const slowestKeysOverall = $derived.by(() => {
    return Object.entries(keys)
      .filter(([k, s]) => k !== 'space' && s.n >= 5 && s.ms && s.ms > 0)
      .map(([k, s]) => ({
        key: k,
        avgMs: Math.round((s.ms ?? 0) / s.n),
        errPct: Math.round((s.e / s.n) * 100),
        delCount: s.del ?? 0,
        presses: s.n,
      }))
      .sort((a, b) => b.avgMs - a.avgMs)
      .slice(0, 8);
  });

  const topDeleteTriggersOverall = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const h of history) {
      for (const trig of h.deleteTriggers ?? []) {
        counts.set(trig, (counts.get(trig) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  });

  const topTranspositionsOverall = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const h of history) {
      for (const tr of h.transpositions ?? []) {
        counts.set(tr, (counts.get(tr) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  });

  // Personal bests table across common modes
  const pbModes = [
    { label: '15s Timed', mode: 'time', limit: 15 },
    { label: '30s Timed', mode: 'time', limit: 30 },
    { label: '60s Timed', mode: 'time', limit: 60 },
    { label: '120s Timed', mode: 'time', limit: 120 },
    { label: '25 Words', mode: 'words', limit: 25 },
    { label: '50 Words', mode: 'words', limit: 50 },
  ] as const;

  function bestIn(mode: string, limit: number) {
    let best: TestResult | null = null;
    for (const h of history) {
      if (h.mode === mode && h.limit === limit) {
        if (!best || h.wpm > best.wpm) best = h;
      }
    }
    return best;
  }

  const weakList = $derived(
    Object.entries(weak)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 24),
  );

  function downloadBackup() {
    const blob = new Blob([exportAll()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `toefltyper-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importAll(String(reader.result));
        refresh();
        msg = 'Backup imported!';
      } catch {
        msg = 'Invalid backup file.';
      }
    };
    reader.readAsText(file);
  }

  function handleReset() {
    if (confirm('Clear all local typing history, personal bests, and weak words?')) {
      resetAll();
      refresh();
      msg = 'All stats cleared.';
    }
  }

  function practiceWeak() {
    settings.source = 'weak';
    location.hash = '#/type';
  }
</script>

<section class="stats-page">
  <div class="top-cards">
    <div class="card stat-box">
      <span class="lbl">machine watch alias</span>
      <b class="big alias-txt">{settings.machineAlias}</b>
    </div>
    <div class="card stat-box">
      <span class="lbl">all-time best wpm</span>
      <b class="big accent">{bestWpm || '—'}</b>
    </div>
    <div class="card stat-box">
      <span class="lbl">recent 20 avg wpm</span>
      <b class="big">{avgWpm || '—'}</b>
    </div>
    <div class="card stat-box">
      <span class="lbl">tests · time spent</span>
      <b class="big">{totalTests} · {Math.round(totalSecs / 60)}m</b>
    </div>
  </div>

  <!-- Shared Cross-Machine Watch-Brand Leaderboard -->
  <div class="card">
    <div class="row-between">
      <div>
        <h2>⌚ Cross-Machine Watch-Brand Leaderboard</h2>
        <p class="sub">
          Each machine receives an adapted horology ID ({WATCH_BRANDS.slice(0, 5).join(', ')}, etc.) and automatically syncs
          personal bests across devices.
        </p>
      </div>
      <div class="alias-controls">
        <input
          class="alias-input"
          type="text"
          maxlength="22"
          bind:value={settings.machineAlias}
          aria-label="Machine watch alias"
        />
        <button class="btn" onclick={rerollWatchAlias} title="Roll a new watch-brand ID">↻ Re-roll Watch ID</button>
        <button class="btn" onclick={refreshCloud} disabled={loadingCloud}>
          {loadingCloud ? 'Syncing…' : '⟳ Refresh Board'}
        </button>
      </div>
    </div>

    <div class="filter-tabs">
      <button class="pill" class:on={boardFilter === 'all'} onclick={() => (boardFilter = 'all')}>All Modes</button>
      <button class="pill" class:on={boardFilter === 'time-30'} onclick={() => (boardFilter = 'time-30')}>30s Timed</button>
      <button class="pill" class:on={boardFilter === 'time-60'} onclick={() => (boardFilter = 'time-60')}>60s Timed</button>
      <button class="pill" class:on={boardFilter === 'words-25'} onclick={() => (boardFilter = 'words-25')}>25 Words</button>
    </div>

    {#if filteredCloudScores.length === 0}
      <p class="muted">
        No shared scores recorded for this filter yet. Complete a typing test to post <b>{settings.machineAlias}</b> to the
        board!
      </p>
    {:else}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Machine Watch ID</th>
              <th>WPM</th>
              <th>Accuracy</th>
              <th>Consistency</th>
              <th>Mode & Source</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredCloudScores as entry, idx}
              {@const isMe = entry.machineId === settings.machineId}
              <tr class:me-row={isMe}>
                <td><b>#{idx + 1}</b></td>
                <td>
                  <span class="watch-badge" class:me={isMe}>⌚ {entry.alias}</span>
                  {#if isMe}<small class="you-tag">THIS MACHINE</small>{/if}
                </td>
                <td><b class="accent">{entry.wpm} WPM</b> <small class="muted">({entry.raw} raw)</small></td>
                <td>{entry.acc}%</td>
                <td>{entry.consistency}%</td>
                <td>{entry.mode} {entry.limit || ''} · {entry.source}</td>
                <td class="muted">{new Date(entry.date).toLocaleDateString()}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  <!-- Local Personal Bests -->
  <div class="card">
    <h2>This Machine — Personal Bests</h2>
    <div class="pb-grid">
      {#each pbModes as m}
        {@const pb = bestIn(m.mode, m.limit)}
        <div class="pb-cell">
          <span class="sub">{m.label}</span>
          {#if pb}
            <strong class="wpm">{pb.wpm} <small>WPM</small></strong>
            <span class="meta">{pb.acc}% acc · {pb.source}</span>
          {:else}
            <strong class="wpm muted">—</strong>
            <span class="meta">no record yet</span>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  {#if history.length >= 2}
    <div class="card">
      <h2>WPM & Accuracy Progression (Last {Math.min(history.length, 50)} Tests)</h2>
      <LineChart
        series={[
          { values: history.slice(-50).map((h) => h.wpm), color: 'var(--accent)', label: 'WPM', width: 2.5 },
          { values: history.slice(-50).map((h) => h.acc), color: 'var(--good)', label: 'Accuracy %', width: 2, dashed: true },
        ]}
        xLabel={(i) => `#${i + 1}`}
      />
    </div>
  {/if}

  <!-- Multi-Mode Key Heatmap: Error Rate, Find-Key Latency, and Backspace Triggers -->
  <div class="card">
    <div class="row-between">
      <div>
        <h2>Per-Key Diagnostic Heatmap</h2>
        <p class="sub">
          {#if heatMode === 'error'}
            Showing <b>Error Rate</b> per key (green = accurate, red = frequent mistypes).
          {:else if heatMode === 'latency'}
            Showing <b>Excess Time to Find Key</b> (green = fast &lt;130ms, red = hesitation &gt;250ms).
          {:else}
            Showing <b>Keys Triggering Backspace Deletes</b> (red = keys that most frequently lead to delete bursts).
          {/if}
        </p>
      </div>
      <div class="filter-tabs">
        <button class="pill" class:on={heatMode === 'error'} onclick={() => (heatMode = 'error')}>Error Rate</button>
        <button class="pill" class:on={heatMode === 'latency'} onclick={() => (heatMode = 'latency')}>
          Time to Find Key (ms)
        </button>
        <button class="pill" class:on={heatMode === 'deletes'} onclick={() => (heatMode = 'deletes')}>
          Delete Triggers
        </button>
      </div>
    </div>
    <Keyboard heat={keys} {heatMode} />

    {#if slowestKeysOverall.length > 0 || topDeleteTriggersOverall.length > 0 || topTranspositionsOverall.length > 0}
      <div class="telemetry-summary-grid">
        {#if slowestKeysOverall.length > 0}
          <div class="tel-col">
            <h4>Slowest Keys to Locate (Avg Search Latency)</h4>
            <div class="weak-chips">
              {#each slowestKeysOverall as sk}
                <span class="weak-chip">
                  <b>{sk.key.toUpperCase()}</b>
                  <small class="awl-tag">{sk.avgMs}ms</small>
                  <small class="muted">{sk.errPct}% err</small>
                </span>
              {/each}
            </div>
          </div>
        {/if}

        {#if topTranspositionsOverall.length > 0}
          <div class="tel-col">
            <h4>Most Frequent Key-Order Transpositions</h4>
            <div class="weak-chips">
              {#each topTranspositionsOverall as [pair, cnt]}
                <span class="weak-chip">
                  <b>{pair}</b>
                  <small class="muted">{cnt}×</small>
                </span>
              {/each}
            </div>
          </div>
        {/if}

        {#if topDeleteTriggersOverall.length > 0}
          <div class="tel-col">
            <h4>Top Mistakes Leading to Deletes</h4>
            <div class="weak-chips">
              {#each topDeleteTriggersOverall as [trig, cnt]}
                <span class="weak-chip">
                  <b>{trig}</b>
                  <small class="muted">{cnt}×</small>
                </span>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <div class="card">
    <div class="row-between">
      <div>
        <h2>Weak Words Tracker</h2>
        <p class="sub">Words you mistyped or hesitated on are weighted higher and heal as you type them cleanly.</p>
      </div>
      {#if weakList.length >= 8}
        <button class="btn primary" onclick={practiceWeak}>Drill Weak Words</button>
      {/if}
    </div>
    {#if weakList.length === 0}
      <p class="muted">No weak words recorded yet. Complete a few typing tests first!</p>
    {:else}
      <div class="weak-chips">
        {#each weakList as [w, score]}
          {@const awl = lookupAwl(w)}
          <span class="weak-chip" title={awl ? `AWL S${awl.s}: ${awl.d}` : 'Common word'}>
            <b>{w}</b>
            {#if awl}<small class="awl-tag">AWL S{awl.s}</small>{/if}
            <small class="muted">×{score.toFixed(1)}</small>
          </span>
        {/each}
      </div>
    {/if}
  </div>

  {#if history.length > 0}
    <div class="card">
      <h2>Recent Tests</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Mode</th>
              <th>Source</th>
              <th>WPM</th>
              <th>Raw</th>
              <th>Accuracy</th>
              <th>Consistency</th>
            </tr>
          </thead>
          <tbody>
            {#each [...history].reverse().slice(0, 25) as r}
              <tr>
                <td class="muted">{new Date(r.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td>{r.mode} {r.limit || ''}</td>
                <td>{r.source}{r.punctuation ? ' + @' : ''}</td>
                <td><b class="accent">{r.wpm}</b></td>
                <td>{r.raw}</td>
                <td>{r.acc}%</td>
                <td>{r.consistency}%</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  <div class="card data-controls">
    <div>
      <h3>Local Data Backup</h3>
      <p class="sub">All local progress can be exported as JSON to transfer or back up.</p>
      {#if msg}<p class="accent">{msg}</p>{/if}
    </div>
    <div class="btn-row">
      <button class="btn" onclick={downloadBackup}>Export JSON</button>
      <label class="btn">
        Import JSON
        <input type="file" accept="application/json" onchange={handleImport} hidden />
      </label>
      <button class="btn ghost" onclick={handleReset}>Reset All</button>
    </div>
  </div>
</section>

<style>
  .stats-page {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .top-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 1rem;
  }
  .stat-box .lbl {
    display: block;
    color: var(--sub);
    font-size: 0.85rem;
  }
  .stat-box .big {
    font-family: var(--font-mono);
    font-size: 2.1rem;
  }
  .stat-box .alias-txt {
    font-size: 1.5rem;
    color: var(--accent);
  }
  .accent {
    color: var(--accent);
  }
  h2 {
    margin: 0 0 0.35rem;
    font-size: 1.1rem;
  }
  .alias-controls {
    display: flex;
    gap: 0.45rem;
    flex-wrap: wrap;
    align-items: center;
  }
  .alias-input {
    background: var(--bg);
    color: var(--accent);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.45rem 0.65rem;
    font-family: var(--font-mono);
    font-weight: 600;
    width: 165px;
  }
  .filter-tabs {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    margin: 0.75rem 0;
  }
  .pill {
    background: var(--bg-3);
    border: 1px solid var(--border);
    color: var(--sub);
    padding: 0.3rem 0.7rem;
    border-radius: 6px;
    font-size: 0.82rem;
  }
  .pill.on {
    border-color: var(--accent);
    color: var(--accent);
    font-weight: 600;
  }
  .watch-badge {
    font-family: var(--font-mono);
    font-weight: 600;
    color: var(--text);
  }
  .watch-badge.me {
    color: var(--accent);
  }
  .you-tag {
    background: var(--accent);
    color: var(--bg);
    font-size: 0.65rem;
    font-weight: 700;
    padding: 0.1rem 0.38rem;
    border-radius: 4px;
    margin-left: 0.4rem;
  }
  .me-row {
    background: rgba(245, 185, 66, 0.06);
  }
  .telemetry-summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
    margin-top: 1.15rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border);
  }
  .tel-col h4 {
    margin: 0 0 0.4rem;
    font-size: 0.88rem;
    color: var(--sub);
  }
  .pb-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.85rem;
    margin-top: 0.75rem;
  }
  .pb-cell {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .pb-cell .wpm {
    font-family: var(--font-mono);
    font-size: 1.6rem;
    color: var(--accent);
  }
  .pb-cell .wpm small {
    font-size: 0.75rem;
    color: var(--sub);
  }
  .pb-cell .meta {
    font-size: 0.78rem;
    color: var(--muted);
  }
  .row-between {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .weak-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    margin-top: 0.55rem;
  }
  .weak-chip {
    background: var(--bg);
    border: 1px solid var(--border);
    padding: 0.35rem 0.65rem;
    border-radius: 6px;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .awl-tag {
    color: var(--accent);
    font-size: 0.72rem;
  }
  .table-wrap {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.88rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.55rem 0.65rem;
    border-bottom: 1px solid var(--border);
  }
  th {
    color: var(--sub);
    font-weight: 600;
  }
  .data-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }
  .data-controls h3 {
    margin: 0 0 0.25rem;
    font-size: 1rem;
  }
  .data-controls p {
    margin: 0;
  }
  .btn-row {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
</style>
