# TOEFLtyper

**TOEFLtyper** is an open-source academic touch-typing trainer and full **2026 TOEFL iBT®** practice exam environment hosted on GitHub Pages.

## Key Features

### 1. Academic Word List (AWL) Timed Typing Trainer
- **Complete Vocabulary Pool:** All **570 headword families** from Averil Coxhead's Academic Word List (Sublists 1–10) with definitions, example sentences, and derived word forms, plus the **1,000 most common English words** and **200 academic sentences**.
- **Flexible Modes:** Timed (15s / 30s / 60s / 120s), Word Count (10 / 25 / 50 / 100), Zen mode, Weak Words drill, and Custom Text paste-in.
- **Toggleable Live HUD & Key Clicks:** Independently toggle real-time WPM speed, time/words remaining, live accuracy, on-screen keyboard guide, and synthesized mechanical/soft/typewriter key-click sound effects.
- **Post-Test Vocabulary Review:** Inspect every AWL word encountered during a test (with missed words highlighted) to review its definition, sublist, and word family.

### 2. 2026 TOEFL iBT Exam Environment
- **Authentic Test-Center Interface:** Full-screen ETS-style header, section countdown clock with *Hide Time*, *Review* item grid, and split-pane reading/writing layouts.
- **All Four 2026 Sections & Task Types:**
  - **Reading:** *Complete the Words*, *Read in Daily Life* (emails, group chat chains), and *Academic Passages*.
  - **Listening:** *Choose a Response*, *Campus Conversation*, *Announcement*, and *Academic Talk* with pre-generated multi-voice audio.
  - **Writing:** *Build a Sentence*, *Write an Email* (7 min), and *Write for an Academic Discussion* (10 min) with live word counts, typing WPM, AWL usage detection, and one-click transfer of Band 6.0 model answers into the speed trainer.
  - **Speaking:** *Listen and Repeat* and *Take an Interview* with browser microphone recording and self-playback.
- **Diagnostic Report:** Instant Band 1.0–6.0 estimates, question-by-question explanations, transcripts, and model responses.

### 3. Local Scoreboard & Analytics
- Personal Bests tracked per mode in `localStorage` (no account required), WPM/accuracy progression charts, per-key error heatmap, and JSON backup import/export.

## Development

```bash
npm install
npm run dev      # Start local dev server
npm run check    # Type-check Svelte & TypeScript
npm run build    # Build production bundle into dist/
```

To regenerate the Listening and Speaking `.m4a` audio prompts on macOS:

```bash
./tools/generate_audio.sh
```

## Disclaimer

TOEFL and TOEFL iBT are registered trademarks of ETS. This project is an independent practice tool and is not affiliated with or endorsed by ETS. All practice passages, prompts, and questions in this repository are original works.
