<script lang="ts">
  // QWERTY keyboard: live key highlighting, or an error/speed heatmap.
  import type { KeyStat } from '../lib/storage';

  interface Props {
    pressed?: string | null; // live: last key pressed
    pressedOk?: boolean;
    next?: string | null; // live: the key to press next
    heat?: Record<string, KeyStat> | null;
    compact?: boolean;
  }
  let { pressed = null, pressedOk = true, next = null, heat = null, compact = false }: Props = $props();

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

  function errRate(k: string) {
    const s = heat?.[k];
    if (!s || s.n < 3) return null;
    return s.e / s.n;
  }
  function heatStyle(k: string) {
    if (!heat) return '';
    const r = errRate(k);
    if (r === null) return '';
    // 0% -> good, >=15% -> bad
    const t = Math.min(1, r / 0.15);
    const mix = Math.round(t * 100);
    return `background: color-mix(in srgb, var(--bad) ${mix}%, var(--good) ${100 - mix}%); color: var(--bg); border-color: transparent;`;
  }
  function title(k: string) {
    const s = heat?.[k];
    if (!s) return k;
    return `${k}: ${s.n} presses, ${s.e} errors (${((s.e / Math.max(1, s.n)) * 100).toFixed(1)}%)`;
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

