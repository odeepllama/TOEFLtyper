<script lang="ts">
  import { getHistory } from '../lib/storage';
  import { AWL, COMMON, SENTENCES } from '../lib/words';
  import { settings } from '../lib/settings.svelte';

  const history = getHistory();
  const bestWpm = history.reduce((m, r) => Math.max(m, r.wpm), 0);

  function quickStart(source: 'mixed' | 'awl' | 'sentences', time = 30) {
    settings.mode = 'time';
    settings.time = time;
    settings.source = source;
    location.hash = '#/type';
  }
</script>

<section class="home">
  <div class="hero card">
    <div class="hero-copy">
      <span class="pill-tag">Academic Word List · 2026 TOEFL iBT Environment</span>
      <h1>Fast Academic Touch-Typing Meets Realistic TOEFL Practice</h1>
      <p class="sub">
        Build muscle memory on all <b>{AWL.length} Coxhead Academic Word List</b> families and <b>{COMMON.length} core words</b>,
        then put your speed to work inside a full replica of the 2026 TOEFL iBT interface.
      </p>
      <div class="cta-row">
        <a class="btn primary" href="#/type">Launch Typing Trainer</a>
        <a class="btn" href="#/exam">Enter TOEFL iBT Exam Simulator</a>
        <a class="btn ghost" href="#/stats">Scoreboard & Heatmap</a>
      </div>
    </div>

    <div class="quick-stats">
      <div class="q-stat">
        <span class="num">{AWL.length}</span>
        <span class="lbl">AWL Headwords (Sublists 1–10)</span>
      </div>
      <div class="q-stat">
        <span class="num">{SENTENCES.length}</span>
        <span class="lbl">Academic Drill Sentences</span>
      </div>
      <div class="q-stat">
        <span class="num">{bestWpm || '—'}</span>
        <span class="lbl">Your Best WPM ({history.length} tests)</span>
      </div>
    </div>
  </div>

  <div class="features-grid">
    <div class="card feat">
      <h3>Timed Academic Word List Typing</h3>
      <p class="sub">
        Filter by Coxhead Sublists 1–10, blend AWL vocabulary with high-frequency English words, or type full academic
        sentences with punctuation. Toggle real-time WPM, countdown timer, and mechanical key-click audio on the fly.
      </p>
      <div class="preset-btns">
        <button class="btn" onclick={() => quickStart('mixed', 30)}>30s Mixed AWL</button>
        <button class="btn" onclick={() => quickStart('awl', 60)}>60s Pure AWL</button>
        <button class="btn" onclick={() => quickStart('sentences', 60)}>60s Sentences</button>
      </div>
    </div>

    <div class="card feat">
      <h3>2026 TOEFL iBT Exam Environment</h3>
      <p class="sub">
        Practice all four sections in an authentic ETS test-center shell: <i>Complete the Words</i>, <i>Read in Daily Life</i>,
        <i>Academic Passages</i>, multi-voice <i>Listening</i>, <i>Build a Sentence</i>, <i>Write an Email</i>,
        <i>Academic Discussion</i>, <i>Listen & Repeat</i>, and <i>Speaking Interviews</i>.
      </p>
      <div class="preset-btns">
        <a class="btn primary" href="#/exam">Open Exam Lobby →</a>
      </div>
    </div>

    <div class="card feat">
      <h3>Local Scoreboard & Vocabulary Feedback</h3>
      <p class="sub">
        Track personal bests per mode, inspect WPM and error graphs, view your per-key accuracy heatmap, and review
        definitions and word families for every AWL word you mistype.
      </p>
      <div class="preset-btns">
        <a class="btn" href="#/stats">View Your Stats →</a>
      </div>
    </div>
  </div>
</section>

<style>
  .home {
    display: flex;
    flex-direction: column;
    gap: 1.35rem;
  }
  .hero {
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: 1.5rem;
    align-items: center;
    padding: 1.85rem;
  }
  @media (max-width: 820px) {
    .hero {
      grid-template-columns: 1fr;
    }
  }
  .pill-tag {
    display: inline-block;
    background: var(--bg-3);
    color: var(--accent);
    font-size: 0.78rem;
    font-weight: 600;
    padding: 0.25rem 0.65rem;
    border-radius: 999px;
    margin-bottom: 0.65rem;
  }
  .hero h1 {
    margin: 0 0 0.6rem;
    font-size: 2rem;
    line-height: 1.18;
    letter-spacing: -0.02em;
  }
  .hero p {
    margin: 0 0 1.2rem;
    line-height: 1.6;
  }
  .cta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.65rem;
  }
  .cta-row a {
    text-decoration: none;
  }
  .quick-stats {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .q-stat {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.85rem 1rem;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .q-stat .num {
    font-family: var(--font-mono);
    font-size: 1.65rem;
    font-weight: 700;
    color: var(--accent);
  }
  .q-stat .lbl {
    font-size: 0.84rem;
    color: var(--sub);
  }
  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
    gap: 1.15rem;
  }
  .feat {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 1rem;
  }
  .feat h3 {
    margin: 0 0 0.4rem;
    font-size: 1.12rem;
  }
  .feat p {
    margin: 0;
    line-height: 1.55;
    font-size: 0.92rem;
  }
  .preset-btns {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .preset-btns a {
    text-decoration: none;
  }
</style>
