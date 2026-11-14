<script lang="ts">
  import { getHistory, getKeyStats, getWeakWords, exportAll, importAll, resetAll, type TestResult } from '../lib/storage';
  import { lookupAwl } from '../lib/words';
  import { settings } from '../lib/settings.svelte';
  import LineChart from '../components/LineChart.svelte';
  import Keyboard from '../components/Keyboard.svelte';

  let history = $state<TestResult[]>(getHistory());
  let keys = $state(getKeyStats());
  let weak = $state(getWeakWords());
  let msg = $state('');

  function refresh() {
    history = getHistory();
    keys = getKeyStats();
    weak = getWeakWords();
  }

  const totalTests = $derived(history.length);
  const totalSecs = $derived(history.reduce((a, r) => a + (r.duration || 0), 0));
  const bestWpm = $derived(history.reduce((m, r) => Math.max(m, r.wpm), 0));
  const avgWpm = $derived.by(() => {
    const recent = history.slice(-20);
    if (!recent.length) return 0;
    return Math.round(recent.reduce((a, r) => a + r.wpm, 0) / recent.length);
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
      } catch (err) {
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
      <span class="lbl">tests completed</span>
      <b class="big">{totalTests}</b>
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
      <span class="lbl">time spent typing</span>
      <b class="big">{Math.round(totalSecs / 60)}m</b>
    </div>
  </div>

  <div class="card">
    <h2>Local Scoreboard — Personal Bests</h2>
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

  <div class="card">
    <h2>Per-Key Error Heatmap</h2>
    <p class="sub">Green keys have high accuracy; red keys have higher error rates (minimum 3 presses).</p>
    <Keyboard heat={keys} />
  </div>

  <div class="card">
    <div class="row-between">
      <div>
        <h2>Weak Words Tracker</h2>
        <p class="sub">Words you mistyped recently are weighted higher and heal as you type them cleanly.</p>
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
      <p class="sub">All progress is stored locally in your browser. Export JSON to transfer or back up.</p>
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
    font-size: 2.3rem;
  }
  .accent {
    color: var(--accent);
  }
  h2 {
    margin: 0 0 0.75rem;
    font-size: 1.1rem;
  }
  .pb-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.85rem;
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
    margin-top: 0.75rem;
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

