// Persistent user settings (localStorage), using Svelte 5 runes.

export type Source = 'common200' | 'common1000' | 'awl' | 'mixed' | 'sentences' | 'weak' | 'custom';
export type Mode = 'time' | 'words' | 'zen';
export type SoundPack =
  | 'mechanical'
  | 'soft'
  | 'typewriter'
  | 'pop'
  | 'topre'
  | 'holy-panda'
  | 'model-m'
  | 'laptop';
export type Theme = 'dark' | 'light' | 'sepia';
export type TypingFont = 'mono' | 'sans' | 'serif';

export const WATCH_BRANDS = [
  'Patekster',
  'Omyga',
  'Rolexion',
  'Seikonaut',
  'Breitlinger',
  'Cartieris',
  'TagHeuerist',
  'Tudorian',
  'Casioak',
  'GrandSeikist',
  'Audemarsia',
  'Vacheroni',
  'Longinex',
  'IWCafarian',
  'Zenithar',
  'Panerista',
  'Hublotek',
  'Jaegerist',
  'Tissotian',
  'Orisinal',
  'Sinnmeister',
  'Hamiltonic',
] as const;

export function generateWatchId(): string {
  const brand = WATCH_BRANDS[Math.floor(Math.random() * WATCH_BRANDS.length)];
  const num = String(Math.floor(10 + Math.random() * 90));
  return `${brand}-${num}`;
}

export interface Settings {
  // machine identity & shared leaderboard
  machineId: string;
  machineAlias: string;
  cloudSync: boolean;
  customCloudUrl: string;
  // test config
  mode: Mode;
  time: number; // seconds
  words: number; // word count
  source: Source;
  sublists: number[]; // AWL sublists 1-10
  awlRatio: number; // 0-100, % AWL in mixed mode
  families: boolean; // include AWL word-family forms
  punctuation: boolean;
  customText: string;
  // behaviour
  stopOnError: boolean;
  strictSpace: boolean; // space only advances when word is correct
  // live HUD
  showWpm: boolean;
  showTime: boolean;
  showAccuracy: boolean;
  showKeyboard: boolean;
  // sound
  sound: boolean;
  soundPack: SoundPack;
  volume: number; // 0-100
  errorSound: boolean;
  // look
  theme: Theme;
  font: TypingFont;
  fontSize: number; // rem * 10
  // ETS exam accessibility zoom (100 = realistic 1024x768 monitor scale, 125, 150)
  etsZoom: 100 | 125 | 150;
}

const KEY = 'toefltyper.settings.v1';

function createInitialDefaults(): Settings {
  const alias = generateWatchId();
  return {
    machineId: `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    machineAlias: alias,
    cloudSync: true,
    customCloudUrl: '',
    mode: 'time',
    time: 30,
    words: 25,
    source: 'mixed',
    sublists: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    awlRatio: 50,
    families: true,
    punctuation: false,
    customText: '',
    stopOnError: false,
    strictSpace: false,
    showWpm: true,
    showTime: true,
    showAccuracy: false,
    showKeyboard: false,
    sound: true,
    soundPack: 'mechanical',
    volume: 50,
    errorSound: true,
    theme: 'dark',
    font: 'mono',
    fontSize: 24,
    etsZoom: 100,
  };
}

export const defaults: Settings = createInitialDefaults();

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const merged: Settings = { ...defaults, ...parsed };
    if (!merged.machineId) merged.machineId = defaults.machineId;
    if (!merged.machineAlias) merged.machineAlias = generateWatchId();
    if (!merged.etsZoom) merged.etsZoom = 100;
    return merged;
  } catch {
    return { ...defaults };
  }
}

export const settings: Settings = $state(load());

export function rerollWatchAlias() {
  settings.machineAlias = generateWatchId();
}

export function resetSettings() {
  const keepId = settings.machineId;
  const keepAlias = settings.machineAlias;
  Object.assign(settings, defaults, { machineId: keepId, machineAlias: keepAlias });
}

$effect.root(() => {
  $effect(() => {
    localStorage.setItem(KEY, JSON.stringify(settings));
  });
  $effect(() => {
    document.documentElement.dataset.theme = settings.theme;
  });
});
