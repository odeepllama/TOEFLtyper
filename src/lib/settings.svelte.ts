// Persistent user settings (localStorage), using Svelte 5 runes.

export type Source = 'common200' | 'common1000' | 'awl' | 'mixed' | 'sentences' | 'weak' | 'custom';
export type Mode = 'time' | 'words' | 'zen';
export type SoundPack = 'mechanical' | 'soft' | 'typewriter' | 'pop';
export type Theme = 'dark' | 'light' | 'sepia';
export type TypingFont = 'mono' | 'sans' | 'serif';

export interface Settings {
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
}

const KEY = 'toefltyper.settings.v1';

export const defaults: Settings = {
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
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return { ...defaults, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...defaults };
  }
}

export const settings: Settings = $state(load());

export function resetSettings() {
  Object.assign(settings, defaults);
}

$effect.root(() => {
  $effect(() => {
    localStorage.setItem(KEY, JSON.stringify(settings));
  });
  $effect(() => {
    document.documentElement.dataset.theme = settings.theme;
  });
});

