<script lang="ts">
  // QWERTY keyboard: live key highlighting, error-rate heatmap, or latency/hesitation heatmap.
  import type { KeyStat } from '../lib/storage';

  interface Props {
    pressed?: string | null; // live: last key pressed
    pressedOk?: boolean;
    next?: string | null; // live: the key to press next
    heat?: Record<string, KeyStat> | null;
    heatMode?: 'error' | 'latency' | 'deletes';
    compact?: boolean;
  }
  let {
    pressed = null,
    pressedOk = true,
    next = null,
    heat = null,
    heatMode = 'error',
    compact = false,
  }: Props = $props();

  const rows = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'],
  ];
  const offsets = [0, 0.35, 0.85];

  const shiftMap: Record<string, string> = { '?': '/', ':': ';', '"': "'", '!': '1', '<': ',', '>': '.' };
  const norm = (k: string | null) => {
    if (!k) return null;
    const l = k.toLowerCase();
    return shiftMap[k] ?? (l === ' ' ? 'space' : l);
  };
  const p = $derived(norm(pressed));
  const nx = $derived(norm(next));

  function metricRatio(k: string): number | null {
    const s = heat?.[k];
    if (!s || s.n < 3) return null;
    if (heatMode === 'latency') {
      if (!s.ms) return null;
      const avgMs = s.ms / s.n;
      // 110ms -> 0 (fast/green), 280ms+ -> 1 (slow/red)
      return Math.max(0, Math.min(1, (avgMs - 110) / 170));
    }
    if (heatMode === 'deletes') {
      const delRate = (s.del ?? 0) / s.n;
      return Math.min(1, delRate / 0.12);
    }
    return Math.min(1, s.e / s.n / 0.15);
  }

  function heatStyle(k: string) {
    if (!heat) return '';
    const t = metricRatio(k);
    if (t === null) return '';
    const mix = Math.round(t * 100);
    return `background: color-mix(in srgb, var(--bad) ${mix}%, var(--good) ${100 - mix}%); color: var(--bg); border-color: transparent;`;
  }

  function title(k: string) {
    const s = heat?.[k];
    if (!s) return k;
    const errPct = ((s.e / Math.max(1, s.n)) * 100).toFixed(1);
    const avgMs = s.ms ? `${Math.round(s.ms / s.n)}ms avg find time` : '';
    const dels = s.del ? ` · ${s.del} delete triggers` : '';
    return `${k.toUpperCase()}: ${s.n} presses, ${s.e} errors (${errPct}%)${avgMs ? ' · ' + avgMs : ''}${dels}`;
  }
</script>

<div class="kb" class:compact>
  {#each rows as row, ri}
    <div class="row" style="padding-left: {offsets[ri] * 2.6}em">
      {#each row as k}
        <div
          class="key"
          class:home={k === 'f' || k === 'j'}
          class:press={p === k}
          class:bad={p === k && !pressedOk}
          class:next={nx === k}
          style={heatStyle(k)}
          title={title(k)}
        >
          {k}
        </div>
      {/each}
    </div>
  {/each}
  <div class="row" style="justify-content:center">
    <div
      class="key space"
      class:press={p === 'space'}
      class:next={nx === 'space'}
      style={heatStyle('space')}
      title={title('space')}
    ></div>
  </div>
</div>

<style>
  .kb {
    display: flex;
    flex-direction: column;
    gap: 0.35em;
    font-family: var(--font-mono);
    font-size: 0.95rem;
    user-select: none;
    width: fit-content;
    margin: 0 auto;
  }
  .kb.compact {
    font-size: 0.75rem;
  }
  .row {
    display: flex;
    gap: 0.35em;
  }
  .key {
    width: 2.25em;
    height: 2.25em;
    display: grid;
    place-items: center;
    border-radius: 6px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    color: var(--sub);
    transition: background 0.12s, color 0.12s, transform 0.08s;
  }
  .key.home {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .key.next {
    border-color: var(--accent);
    color: var(--accent);
  }
  .key.press {
    background: var(--accent);
    color: var(--bg);
    transform: translateY(2px);
    transition: none;
  }
  .key.press.bad {
    background: var(--bad);
  }
  .key.space {
    width: 15em;
  }
</style>
