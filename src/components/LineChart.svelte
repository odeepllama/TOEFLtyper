<script lang="ts">
  // Lightweight responsive SVG line chart.
  interface Series {
    values: number[];
    color: string;
    label: string;
    width?: number;
    dashed?: boolean;
  }
  interface Props {
    series: Series[];
    markers?: number[]; // marker counts per x (e.g. errors)
    xLabel?: (i: number) => string;
    height?: number;
    yLabel?: string;
  }
  let { series, markers = [], xLabel = (i) => String(i + 1), height = 220, yLabel = '' }: Props = $props();

  const W = 800;
  const pad = { l: 44, r: 16, t: 14, b: 28 };

  const n = $derived(Math.max(1, ...series.map((s) => s.values.length)));
  const yMax = $derived.by(() => {
    const m = Math.max(10, ...series.flatMap((s) => s.values));
    const step = m > 150 ? 50 : m > 60 ? 20 : 10;
    return Math.ceil((m * 1.05) / step) * step;
  });
  const ticks = $derived.by(() => {
    const step = yMax / 4;
    return [0, 1, 2, 3, 4].map((i) => Math.round(i * step));
  });
  const x = (i: number) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / yMax) * (height - pad.t - pad.b);

  function path(vals: number[]) {
    if (!vals.length) return '';
    if (vals.length === 1) return `M${x(0)},${y(vals[0])} L${W - pad.r},${y(vals[0])}`;
    return vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  }
  const xTicks = $derived.by(() => {
    const count = Math.min(n, 10);
    const out: number[] = [];
    for (let k = 0; k < count; k++) out.push(Math.round((k * (n - 1)) / Math.max(1, count - 1)));
    return [...new Set(out)];
  });
</script>

<div class="chart">
  <svg viewBox="0 0 {W} {height}" preserveAspectRatio="none" role="img" aria-label="chart">
    {#each ticks as t}
      <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} class="grid" />
      <text x={pad.l - 8} y={y(t) + 4} text-anchor="end" class="lbl">{t}</text>
    {/each}
    {#each xTicks as i}
      <text x={x(i)} y={height - 8} text-anchor="middle" class="lbl">{xLabel(i)}</text>
    {/each}
    {#if yLabel}
      <text x="12" y={height / 2} transform="rotate(-90 12 {height / 2})" text-anchor="middle" class="lbl">{yLabel}</text>
    {/if}
    {#each series as s}
      <path
        d={path(s.values)}
        fill="none"
        stroke={s.color}
        stroke-width={s.width ?? 2.5}
        stroke-dasharray={s.dashed ? '6 5' : undefined}
        stroke-linejoin="round"
        stroke-linecap="round"
        vector-effect="non-scaling-stroke"
      />
    {/each}
    {#each markers as m, i}
      {#if m > 0}
        <g class="err">
          <line x1={x(i) - 4} y1={pad.t + 4} x2={x(i) + 4} y2={pad.t + 12} />
          <line x1={x(i) + 4} y1={pad.t + 4} x2={x(i) - 4} y2={pad.t + 12} />
          <title>{m} error{m > 1 ? 's' : ''} at {xLabel(i)}</title>
        </g>
      {/if}
    {/each}
  </svg>
  <div class="legend">
    {#each series as s}
      <span><i style="background:{s.color}"></i>{s.label}</span>
    {/each}
    {#if markers.some((m) => m > 0)}
      <span><i class="x">×</i>errors</span>
    {/if}
  </div>
</div>

<style>
  .chart {
    width: 100%;
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
    overflow: visible;
  }
  .grid {
    stroke: var(--border);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .lbl {
    fill: var(--muted);
    font-size: 12px;
    font-family: var(--font-mono);
  }
  .err line {
    stroke: var(--bad);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }
  .legend {
    display: flex;
    gap: 1.25rem;
    justify-content: center;
    font-size: 0.8rem;
    color: var(--sub);
    margin-top: 0.25rem;
  }
  .legend span {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .legend i {
    width: 14px;
    height: 3px;
    border-radius: 2px;
    display: inline-block;
  }
  .legend i.x {
    width: auto;
    height: auto;
    color: var(--bad);
    font-style: normal;
    font-weight: 700;
  }
</style>

