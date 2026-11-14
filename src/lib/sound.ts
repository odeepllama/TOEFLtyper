// Synthesised key-click sounds via Web Audio (no audio assets needed).
import type { SoundPack } from './settings.svelte';

export type ClickKind = 'key' | 'space' | 'back' | 'error';

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function audio(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    const len = Math.floor(ctx.sampleRate * 0.25);
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

const jitter = (v: number, amt = 0.08) => v * (1 + (Math.random() * 2 - 1) * amt);

function envGain(c: AudioContext, t: number, peak: number, attack: number, decay: number) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}

function noiseBurst(
  c: AudioContext,
  out: AudioNode,
  t: number,
  type: BiquadFilterType,
  freq: number,
  q: number,
  peak: number,
  decay: number,
) {
  const src = c.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = jitter(1, 0.15);
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = jitter(freq);
  f.Q.value = q;
  const g = envGain(c, t, peak, 0.001, decay);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 0.1);
  src.stop(t + decay + 0.05);
}

function tone(
  c: AudioContext,
  out: AudioNode,
  t: number,
  type: OscillatorType,
  f0: number,
  f1: number,
  peak: number,
  decay: number,
) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(jitter(f0, 0.04), t);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + decay);
  const g = envGain(c, t, peak, 0.002, decay);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + decay + 0.05);
}

export function playClick(pack: SoundPack, volume: number, kind: ClickKind) {
  if (volume <= 0) return;
  let c: AudioContext;
  try {
    c = audio();
  } catch {
    return;
  }
  const t = c.currentTime;
  const master = c.createGain();
  master.gain.value = (volume / 100) * 0.9;
  master.connect(c.destination);

  if (kind === 'error') {
    tone(c, master, t, 'triangle', 180, 110, 0.35, 0.12);
    return;
  }

  const big = kind === 'space';
  switch (pack) {
    case 'mechanical':
      // sharp click + low "thock"
      noiseBurst(c, master, t, 'bandpass', big ? 1800 : 3200, 1.2, 0.9, big ? 0.045 : 0.03);
      tone(c, master, t, 'sine', big ? 120 : 190, big ? 70 : 110, big ? 0.6 : 0.4, big ? 0.07 : 0.045);
      break;
    case 'soft':
      noiseBurst(c, master, t, 'lowpass', big ? 700 : 1100, 0.7, 0.8, big ? 0.05 : 0.03);
      break;
    case 'typewriter':
      noiseBurst(c, master, t, 'highpass', 2500, 0.8, 0.7, 0.025);
      tone(c, master, t, 'square', big ? 140 : 1900, big ? 80 : 1700, big ? 0.25 : 0.06, big ? 0.09 : 0.02);
      if (big) noiseBurst(c, master, t + 0.01, 'lowpass', 400, 1, 0.8, 0.08);
      break;
    case 'pop':
      tone(c, master, t, 'sine', big ? 420 : 700, big ? 200 : 350, 0.5, big ? 0.07 : 0.045);
      break;
  }
  if (kind === 'back') {
    // slightly duller
    master.gain.value *= 0.7;
  }
}

