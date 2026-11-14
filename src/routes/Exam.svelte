<script lang="ts">
  import { onDestroy } from 'svelte';
  import { MOCK_TESTS } from '../data/exams';
  import type {
    MockTest,
    SectionKind,
    ReadingTask,
    CompleteWordsItem,
    DailyLifeReadingItem,
    AcademicPassageItem,
    ListeningItem,
  } from '../lib/examTypes';
  import { lookupAwl } from '../lib/words';
  import { settings } from '../lib/settings.svelte';

  interface Props {
    route: string;
  }
  let { route }: Props = $props();

  let selectedTestId = $state(MOCK_TESTS[0].id);
  const currentTest = $derived<MockTest>(MOCK_TESTS.find((t) => t.id === selectedTestId) ?? MOCK_TESTS[0]);

  // Active exam runner state
  let active = $state(false);
  let activeSections = $state<SectionKind[]>(['reading', 'listening', 'writing', 'speaking']);
  let secIdx = $state(0);
  const currentSection = $derived<SectionKind>(activeSections[secIdx] ?? 'reading');

  // Step index within the current section
  let stepIdx = $state(0);
  let hideTime = $state(false);
  let showReviewModal = $state(false);
  let showWordCount = $state(true);
  let untimedMode = $state(false);
  let finished = $state(false);

  // Section countdown timer
  let remainingSec = $state(0);
  let timerId: ReturnType<typeof setInterval> | null = null;

  // User responses
  let cwInputs = $state<Record<string, string[]>>({}); // itemId -> array of user completions
  let mcqAnswers = $state<Record<string, number>>({}); // questionId -> optionIdx
  let sentenceBuilt = $state<Record<string, number[]>>({}); // promptId -> ordered indices of chunks
  let emailDraft = $state('');
  let discussionDraft = $state('');
  let emailStartMs = 0;
  let discStartMs = 0;
  let emailWpm = $state(0);
  let discWpm = $state(0);

  // Audio playback state
  let audioEl = $state<HTMLAudioElement | null>(null);
  let audioPlaying = $state(false);
  let audioProgress = $state(0);
  let audioVolume = $state(90);

  // Microphone recording state for Speaking
  let recorder: MediaRecorder | null = null;
  let recordedChunks: Blob[] = [];
  let recordings = $state<Record<string, string>>({}); // promptId -> objectURL
  let isRecording = $state(false);
  let activeRecordId = $state<string | null>(null);
  let micError = $state('');

  // Flatten Reading steps: each CompleteWords is 1 step; each DailyLife / AcademicPassage question is 1 step
  interface ReadingStep {
    task: ReadingTask;
    qIdx: number; // 0 for complete_words, 0..N-1 for passages
    label: string;
  }

  const readingSteps = $derived.by<ReadingStep[]>(() => {
    const out: ReadingStep[] = [];
    for (const t of currentTest.reading.tasks) {
      if (t.kind === 'complete_words') {
        out.push({ task: t, qIdx: 0, label: `Complete the Words: ${t.topic}` });
      } else {
        t.questions.forEach((q, qi) => {
          out.push({
            task: t,
            qIdx: qi,
            label: `${t.title} (Q${qi + 1})`,
          });
        });
      }
    }
    return out;
  });

  // Flatten Listening steps: each question in each ListeningItem is a step
  interface ListeningStep {
    item: ListeningItem;
    qIdx: number;
    label: string;
  }

  const listeningSteps = $derived.by<ListeningStep[]>(() => {
    const out: ListeningStep[] = [];
    for (const item of currentTest.listening.items) {
      item.questions.forEach((_, qi) => {
        out.push({ item, qIdx: qi, label: `${item.title} (Q${qi + 1})` });
      });
    }
    return out;
  });

  // Flatten Writing steps: Build-a-Sentence items + Email + Academic Discussion
  interface WritingStep {
    kind: 'build' | 'email' | 'discussion';
    buildIdx?: number;
    label: string;
  }

  const writingSteps = $derived.by<WritingStep[]>(() => {
    const out: WritingStep[] = [];
    currentTest.writing.buildSentences.items.forEach((_, i) => {
      out.push({ kind: 'build', buildIdx: i, label: `Build a Sentence #${i + 1}` });
    });
    out.push({ kind: 'email', label: 'Write an Email (7 min)' });
    out.push({ kind: 'discussion', label: 'Write for an Academic Discussion (10 min)' });
    return out;
  });

  // Flatten Speaking steps: Listen & Repeat 1..5 + Interview 1..3
  interface SpeakingStep {
    kind: 'repeat' | 'interview';
    idx: number;
    label: string;
  }

  const speakingSteps = $derived.by<SpeakingStep[]>(() => {
    const out: SpeakingStep[] = [];
    currentTest.speaking.listenRepeat.forEach((_, i) => {
      out.push({ kind: 'repeat', idx: i, label: `Listen & Repeat #${i + 1}` });
    });
    currentTest.speaking.interviewTurns.forEach((_, i) => {
      out.push({ kind: 'interview', idx: i, label: `Take an Interview #${i + 1}` });
    });
    return out;
  });

  const totalStepsInSection = $derived.by(() => {
    switch (currentSection) {
      case 'reading':
        return readingSteps.length;
      case 'listening':
        return listeningSteps.length;
      case 'writing':
        return writingSteps.length;
      case 'speaking':
        return speakingSteps.length;
    }
  });

  // Helper to parse `pre[missing]` tokens in Complete the Words
  interface CwToken {
    kind: 'text' | 'blank';
    text?: string;
    prefix?: string;
    answer?: string;
    blankIdx?: number;
  }

  function parseCompleteWords(template: string): CwToken[] {
    const tokens: CwToken[] = [];
    const re = /([A-Za-z]+)\[([A-Za-z]+)\]/g;
    let last = 0;
    let bi = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(template)) !== null) {
      if (m.index > last) {
        tokens.push({ kind: 'text', text: template.slice(last, m.index) });
      }
      tokens.push({
        kind: 'blank',
        prefix: m[1],
        answer: m[2],
        blankIdx: bi++,
      });
      last = re.lastIndex;
    }
    if (last < template.length) {
      tokens.push({ kind: 'text', text: template.slice(last) });
    }
    return tokens;
  }

  function sectionDuration(sec: SectionKind): number {
    switch (sec) {
      case 'reading':
        return currentTest.reading.durationSeconds;
      case 'listening':
        return currentTest.listening.durationSeconds;
      case 'writing':
        return (
          currentTest.writing.buildSentences.durationSeconds +
          currentTest.writing.email.recommendedMinutes * 60 +
          currentTest.writing.discussion.recommendedMinutes * 60
        );
      case 'speaking':
        return 8 * 60;
    }
  }

  function startExam(sections: SectionKind[], untimed = false) {
    stopTimer();
    stopRecording();
    activeSections = sections;
    secIdx = 0;
    stepIdx = 0;
    untimedMode = untimed;
    finished = false;
    active = true;

    // Initialize blank arrays for Complete the Words
    const initCw: Record<string, string[]> = {};
    for (const t of currentTest.reading.tasks) {
      if (t.kind === 'complete_words') {
        const count = parseCompleteWords(t.template).filter((x) => x.kind === 'blank').length;
        initCw[t.id] = Array(count).fill('');
      }
    }
    cwInputs = initCw;
    mcqAnswers = {};
    sentenceBuilt = {};
    emailDraft = '';
    discussionDraft = '';
    emailStartMs = 0;
    discStartMs = 0;

    location.hash = '#/exam/run';
    startSectionTimer(sections[0]);
  }

  function startSectionTimer(sec: SectionKind) {
    stopTimer();
    remainingSec = sectionDuration(sec);
    if (untimedMode) return;
    timerId = setInterval(() => {
      if (remainingSec > 0) {
        remainingSec--;
      } else {
        advanceSectionOrFinish();
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function formatClock(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function nextStep() {
    stopAudio();
    stopRecording();
    if (stepIdx < totalStepsInSection - 1) {
      stepIdx++;
      onStepEnter();
    } else {
      advanceSectionOrFinish();
    }
  }

  function prevStep() {
    stopAudio();
    stopRecording();
    if (stepIdx > 0) {
      stepIdx--;
      onStepEnter();
    }
  }

  function onStepEnter() {
    if (currentSection === 'writing') {
      const ws = writingSteps[stepIdx];
      if (ws?.kind === 'email' && !emailStartMs) emailStartMs = performance.now();
      if (ws?.kind === 'discussion' && !discStartMs) discStartMs = performance.now();
    }
  }

  function advanceSectionOrFinish() {
    stopAudio();
    stopRecording();
    if (secIdx < activeSections.length - 1) {
      secIdx++;
      stepIdx = 0;
      startSectionTimer(activeSections[secIdx]);
      onStepEnter();
    } else {
      stopTimer();
      finished = true;
      location.hash = '#/exam/review';
    }
  }

  function exitExam() {
    stopTimer();
    stopAudio();
    stopRecording();
    active = false;
    finished = false;
    location.hash = '#/exam';
  }

  function playPromptAudio(src: string) {
    stopAudio();
    const url = import.meta.env.BASE_URL + src.replace(/^\//, '');
    const a = new Audio(url);
    a.volume = audioVolume / 100;
    audioEl = a;
    audioPlaying = true;
    audioProgress = 0;
    a.ontimeupdate = () => {
      if (a.duration) audioProgress = Math.round((a.currentTime / a.duration) * 100);
    };
    a.onended = () => {
      audioPlaying = false;
      audioProgress = 100;
    };
    a.onerror = () => {
      audioPlaying = false;
    };
    void a.play();
  }

  function stopAudio() {
    if (audioEl) {
      audioEl.pause();
      audioEl = null;
    }
    audioPlaying = false;
  }

  async function toggleRecording(promptId: string) {
    if (isRecording) {
      stopRecording();
      return;
    }
    micError = '';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunks = [];
      recorder = new MediaRecorder(stream);
      activeRecordId = promptId;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'audio/webm' });
        recordings[promptId] = URL.createObjectURL(blob);
        stream.getTracks().forEach((t) => t.stop());
        isRecording = false;
      };
      recorder.start();
      isRecording = true;
    } catch {
      micError = 'Microphone permission was denied or unavailable.';
    }
  }

  function stopRecording() {
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    isRecording = false;
  }

  // Word counter and AWL detector for writing responses
  function countWords(txt: string): number {
    const t = txt.trim();
    return t ? t.split(/\s+/).length : 0;
  }

  function detectAwlUsed(txt: string): string[] {
    const words = txt
      .toLowerCase()
      .split(/[^a-z-]+/)
      .filter(Boolean);
    const found = new Set<string>();
    for (const w of words) {
      const e = lookupAwl(w);
      if (e) found.add(e.w);
    }
    return [...found];
  }

  function updateEmailWpm() {
    if (!emailStartMs) emailStartMs = performance.now();
    const mins = Math.max((performance.now() - emailStartMs) / 60000, 0.1);
    emailWpm = Math.round(countWords(emailDraft) / mins);
  }

  function updateDiscWpm() {
    if (!discStartMs) discStartMs = performance.now();
    const mins = Math.max((performance.now() - discStartMs) / 60000, 0.1);
    discWpm = Math.round(countWords(discussionDraft) / mins);
  }

  function sendModelToTypingDrill(text: string) {
    settings.source = 'custom';
    settings.customText = text.replace(/\s+/g, ' ').trim();
    settings.mode = 'time';
    settings.time = 60;
    location.hash = '#/type';
  }

  // Build-a-Sentence helpers
  function toggleChunk(promptId: string, chunkIdx: number) {
    const cur = sentenceBuilt[promptId] ?? [];
    if (cur.includes(chunkIdx)) {
      sentenceBuilt[promptId] = cur.filter((i) => i !== chunkIdx);
    } else {
      sentenceBuilt[promptId] = [...cur, chunkIdx];
    }
  }

  function builtSentenceString(promptId: string, chunks: string[], punct = '.'): string {
    const order = sentenceBuilt[promptId] ?? [];
    if (!order.length) return '';
    const raw = order.map((i) => chunks[i]).join(' ');
    const capped = raw.charAt(0).toUpperCase() + raw.slice(1);
    return /[.?!]$/.test(capped) ? capped : capped + punct;
  }

  // Compute score summary for Review screen
  const scoreSummary = $derived.by(() => {
    let rCorrect = 0;
    let rTotal = 0;
    for (const t of currentTest.reading.tasks) {
      if (t.kind === 'complete_words') {
        const blanks = parseCompleteWords(t.template).filter((x) => x.kind === 'blank');
        const userArr = cwInputs[t.id] ?? [];
        blanks.forEach((b, i) => {
          rTotal++;
          if ((userArr[i] ?? '').trim().toLowerCase() === (b.answer ?? '').toLowerCase()) {
            rCorrect++;
          }
        });
      } else {
        for (const q of t.questions) {
          rTotal++;
          if (mcqAnswers[q.id] === q.answer) rCorrect++;
        }
      }
    }

    let lCorrect = 0;
    let lTotal = 0;
    for (const item of currentTest.listening.items) {
      for (const q of item.questions) {
        lTotal++;
        if (mcqAnswers[q.id] === q.answer) lCorrect++;
      }
    }

    let bsCorrect = 0;
    const bsItems = currentTest.writing.buildSentences.items;
    for (const item of bsItems) {
      const endChar = item.answer.trim().slice(-1);
      const built = builtSentenceString(item.id, item.chunks, endChar);
      if (built.toLowerCase() === item.answer.toLowerCase()) bsCorrect++;
    }

    // 2026 TOEFL 1.0 - 6.0 band estimation (in 0.5 increments)
    const rRatio = rTotal ? rCorrect / rTotal : 0;
    const lRatio = lTotal ? lCorrect / lTotal : 0;
    const toBand = (ratio: number) => Math.max(1, Math.round((1 + ratio * 5) * 2) / 2);

    return {
      rCorrect,
      rTotal,
      rBand: toBand(rRatio),
      lCorrect,
      lTotal,
      lBand: toBand(lRatio),
      bsCorrect,
      bsTotal: bsItems.length,
    };
  });

  onDestroy(() => {
    stopTimer();
    stopAudio();
    stopRecording();
  });
</script>

{#if !active && !finished}
  <!-- Exam Lobby -->
  <section class="exam-lobby">
    <div class="hero card">
      <div>
        <span class="tag">2026 TOEFL iBT Format · Band Scale 1.0–6.0</span>
        <h1>TOEFL iBT Exam Simulation Environment</h1>
        <p class="sub">
          Practice in a faithful replica of the ETS test-center interface with authentic 2026 task types, section countdowns,
          built-in macOS voice audio, microphone recording, and instant diagnostic explanations.
        </p>
      </div>
      <div class="lobby-actions">
        <button class="btn primary" onclick={() => startExam(['reading', 'listening', 'writing', 'speaking'], false)}>
          Start Full Timed Mock Test
        </button>
        <button class="btn" onclick={() => startExam(['reading', 'listening', 'writing', 'speaking'], true)}>
          Untimed Study Mode
        </button>
      </div>
    </div>

    <div class="sections-grid">
      <div class="card sec-card">
        <div class="sec-head">
          <h3>1. Reading Section</h3>
          <span class="badge">18 mins</span>
        </div>
        <ul>
          <li><b>Complete the Words:</b> Fill missing letters in 10 academic words per paragraph</li>
          <li><b>Read in Daily Life:</b> Campus emails, notices, and group chat chains</li>
          <li><b>Academic Passage:</b> Split-screen scholarly text with comprehension questions</li>
        </ul>
        <button class="btn" onclick={() => startExam(['reading'], false)}>Practice Reading Only</button>
      </div>

      <div class="card sec-card">
        <div class="sec-head">
          <h3>2. Listening Section</h3>
          <span class="badge">16 mins</span>
        </div>
        <ul>
          <li><b>Choose a Response:</b> Pick the best reply to a spoken campus question</li>
          <li><b>Campus Conversation & Announcement:</b> Multi-voice advisement & studio notices</li>
          <li><b>Academic Talk:</b> University lecture on Urban Economics</li>
        </ul>
        <button class="btn" onclick={() => startExam(['listening'], false)}>Practice Listening Only</button>
      </div>

      <div class="card sec-card">
        <div class="sec-head">
          <h3>3. Writing Section</h3>
          <span class="badge">23 mins</span>
        </div>
        <ul>
          <li><b>Build a Sentence:</b> Assemble scrambled grammatical chunks into an academic sentence</li>
          <li><b>Write an Email (7m):</b> Address 3 communicative goals with live WPM & word count</li>
          <li><b>Academic Discussion (10m):</b> Contribute to a professor’s seminar forum</li>
        </ul>
        <button class="btn" onclick={() => startExam(['writing'], false)}>Practice Writing Only</button>
      </div>

      <div class="card sec-card">
        <div class="sec-head">
          <h3>4. Speaking Section</h3>
          <span class="badge">8 mins</span>
        </div>
        <ul>
          <li><b>Listen and Repeat:</b> Repeat 5 increasingly complex campus & academic sentences</li>
          <li><b>Take an Interview:</b> Answer 3 progressive questions from an interviewer (45s each)</li>
          <li>Includes microphone capture and self-playback</li>
        </ul>
        <button class="btn" onclick={() => startExam(['speaking'], false)}>Practice Speaking Only</button>
      </div>
    </div>

    <div class="card official-links">
      <h3>Official ETS TOEFL Resources</h3>
      <p class="sub">
        All questions in TOEFLtyper are original items crafted for the 2026 specification. Pair your practice here with
        official ETS sample materials:
      </p>
      <div class="link-row">
        <a href="https://www.ets.org/toefl/test-takers/ibt/prepare.html" target="_blank" rel="noreferrer">
          ETS Official TOEFL iBT Test Prep Hub ↗
        </a>
        <a href="https://www.ets.org/toefl/test-takers/ibt/scores/understand-scores.html" target="_blank" rel="noreferrer">
          CEFR & Band Score Scale Guide ↗
        </a>
      </div>
    </div>
  </section>
{:else if active && !finished}
  <!-- Authentic ETS Test-Center Chrome -->
  <div class="ets-shell">
    <header class="ets-bar">
      <div class="ets-brand">
        <span class="ets-logo">ETS</span>
        <span class="ets-title">TOEFL iBT<sup>®</sup> Practice — {currentSection.toUpperCase()}</span>
      </div>

      <div class="ets-step">
        Item {stepIdx + 1} of {totalStepsInSection}
      </div>

      <div class="ets-controls">
        {#if !untimedMode}
          <div class="ets-timer">
            {#if !hideTime}
              <span class="clock" class:urgent={remainingSec < 120}>{formatClock(remainingSec)}</span>
            {/if}
            <button class="ets-btn ghost" onclick={() => (hideTime = !hideTime)}>
              {hideTime ? 'Show Time' : 'Hide Time'}
            </button>
          </div>
        {:else}
          <span class="ets-untimed">Untimed Study Mode</span>
        {/if}

        {#if currentSection === 'reading'}
          <button class="ets-btn" onclick={() => (showReviewModal = !showReviewModal)}>Review</button>
        {/if}
        <button class="ets-btn" onclick={prevStep} disabled={stepIdx === 0}>Back</button>
        <button class="ets-btn primary" onclick={nextStep}>
          {stepIdx === totalStepsInSection - 1 ? 'Finish Section' : 'Next'}
        </button>
        <button class="ets-btn exit" onclick={exitExam} title="Exit and return to lobby">Exit</button>
      </div>
    </header>

    {#if showReviewModal}
      <div class="ets-modal-backdrop" onclick={() => (showReviewModal = false)} role="presentation">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="ets-modal" onclick={(e) => e.stopPropagation()}>
          <div class="modal-head">
            <h3>Reading Section — Review Items</h3>
            <button class="ets-btn" onclick={() => (showReviewModal = false)}>Close</button>
          </div>
          <table class="review-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Task</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each readingSteps as rs, idx}
                {@const answered =
                  rs.task.kind === 'complete_words'
                    ? (cwInputs[rs.task.id] ?? []).some((x) => x.trim().length > 0)
                    : mcqAnswers[rs.task.questions[rs.qIdx].id] !== undefined}
                <tr>
                  <td>{idx + 1}</td>
                  <td>{rs.label}</td>
                  <td>{answered ? 'Answered' : 'Unanswered'}</td>
                  <td>
                    <button
                      class="ets-btn primary"
                      onclick={() => {
                        stepIdx = idx;
                        showReviewModal = false;
                      }}>Go</button
                    >
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}

    <div class="ets-stage">
      {#if currentSection === 'reading'}
        {@const rs = readingSteps[stepIdx]}
        {#if rs.task.kind === 'complete_words'}
          {@const cw = rs.task as CompleteWordsItem}
          {@const tokens = parseCompleteWords(cw.template)}
          <div class="ets-single-pane">
            <div class="ets-directions">
              <b>Directions:</b> Fill in the missing letters in the numbered blanks below to complete the academic paragraph.
              The number of missing letters is shown in brackets next to each input box.
            </div>
            <h2 class="ets-passage-title">{cw.topic}</h2>
            <p class="cw-paragraph">
              {#each tokens as tok}
                {#if tok.kind === 'text'}
                  <span>{tok.text}</span>
                {:else if tok.blankIdx !== undefined}
                  <span class="cw-word">
                    <span class="cw-prefix">{tok.prefix}</span><input
                      class="cw-input"
                      type="text"
                      maxlength={tok.answer?.length ?? 12}
                      style="width: {Math.max(3.2, (tok.answer?.length ?? 4) * 0.78)}em"
                      placeholder={'_'.repeat(tok.answer?.length ?? 3)}
                      bind:value={cwInputs[cw.id][tok.blankIdx]}
                    /><small class="cw-len">({tok.answer?.length})</small>
                  </span>
                {/if}
              {/each}
            </p>
          </div>
        {:else if rs.task.kind === 'daily_life'}
          {@const dl = rs.task as DailyLifeReadingItem}
          {@const q = dl.questions[rs.qIdx]}
          <div class="ets-split-pane">
            <div class="ets-left-pane">
              <div class="doc-frame">
                <div class="doc-badge">{dl.docType.replace('_', ' ').toUpperCase()}</div>
                <h3>{dl.title}</h3>
                <div class="doc-meta">{dl.meta}</div>
                <pre class="doc-body">{dl.body}</pre>
              </div>
            </div>
            <div class="ets-right-pane">
              <p class="ets-q-prompt">{q.prompt}</p>
              <div class="ets-options">
                {#each q.options as opt, oi}
                  <label class="ets-option" class:selected={mcqAnswers[q.id] === oi}>
                    <input
                      type="radio"
                      name={q.id}
                      checked={mcqAnswers[q.id] === oi}
                      onchange={() => (mcqAnswers[q.id] = oi)}
                    />
                    <span>{opt}</span>
                  </label>
                {/each}
              </div>
            </div>
          </div>
        {:else if rs.task.kind === 'academic_passage'}
          {@const ap = rs.task as AcademicPassageItem}
          {@const q = ap.questions[rs.qIdx]}
          <div class="ets-split-pane">
            <div class="ets-left-pane">
              <div class="discipline-tag">{ap.discipline}</div>
              <h2 class="ets-passage-title">{ap.title}</h2>
              {#each ap.paragraphs as para, pi}
                <p class="ets-para"><span class="para-num">[{pi + 1}]</span> {para}</p>
              {/each}
            </div>
            <div class="ets-right-pane">
              <p class="ets-q-prompt">{q.prompt}</p>
              <div class="ets-options">
                {#each q.options as opt, oi}
                  <label class="ets-option" class:selected={mcqAnswers[q.id] === oi}>
                    <input
                      type="radio"
                      name={q.id}
                      checked={mcqAnswers[q.id] === oi}
                      onchange={() => (mcqAnswers[q.id] = oi)}
                    />
                    <span>{opt}</span>
                  </label>
                {/each}
              </div>
            </div>
          </div>
        {/if}
      {:else if currentSection === 'listening'}
        {@const ls = listeningSteps[stepIdx]}
        {@const q = ls.item.questions[ls.qIdx]}
        <div class="ets-single-pane">
          <div class="audio-card">
            <div class="audio-info">
              <span class="audio-kind">{ls.item.kind.replace('_', ' ').toUpperCase()}</span>
              <h2>{ls.item.title}</h2>
              <p>{ls.item.speakerLabel}</p>
            </div>
            <div class="audio-controls">
              <button class="ets-btn primary" onclick={() => playPromptAudio(ls.item.audioSrc)}>
                {audioPlaying ? '↻ Replay Audio' : '▶ Play Audio'}
              </button>
              <div class="progress-bar">
                <div class="progress-fill" style="width: {audioProgress}%"></div>
              </div>
            </div>
          </div>

          <div class="listening-q-box">
            <p class="ets-q-prompt">{q.prompt}</p>
            <div class="ets-options">
              {#each q.options as opt, oi}
                <label class="ets-option" class:selected={mcqAnswers[q.id] === oi}>
                  <input
                    type="radio"
                    name={q.id}
                    checked={mcqAnswers[q.id] === oi}
                    onchange={() => (mcqAnswers[q.id] = oi)}
                  />
                  <span>{opt}</span>
                </label>
              {/each}
            </div>
          </div>
        </div>
      {:else if currentSection === 'writing'}
        {@const ws = writingSteps[stepIdx]}
        {#if ws.kind === 'build' && ws.buildIdx !== undefined}
          {@const item = currentTest.writing.buildSentences.items[ws.buildIdx]}
          {@const chosen = sentenceBuilt[item.id] ?? []}
          {@const endPunct = item.answer.trim().slice(-1)}
          <div class="ets-single-pane">
            <div class="ets-directions">
              <b>Build a Sentence:</b> Click the word groups in the correct order to form a grammatical academic sentence.
              Click a selected group again to remove it.
            </div>
            <p class="bs-context"><b>Context:</b> {item.context}</p>

            <div class="bs-preview">
              {#if chosen.length === 0}
                <span class="bs-placeholder">Click word chunks below to assemble the sentence...</span>
              {:else}
                <span class="bs-built">{builtSentenceString(item.id, item.chunks, endPunct)}</span>
              {/if}
            </div>

            <div class="bs-chunks">
              {#each item.chunks as ch, ci}
                <button
                  class="bs-chunk"
                  class:used={chosen.includes(ci)}
                  onclick={() => toggleChunk(item.id, ci)}
                >
                  {ch}
                </button>
              {/each}
            </div>

            {#if chosen.length > 0}
              <button class="ets-btn" onclick={() => (sentenceBuilt[item.id] = [])}>Clear Sentence</button>
            {/if}
          </div>
        {:else if ws.kind === 'email'}
          {@const em = currentTest.writing.email}
          <div class="ets-split-pane">
            <div class="ets-left-pane">
              <div class="ets-directions">
                <b>Write an Email</b> (Recommended time: {em.recommendedMinutes} minutes)
              </div>
              <p>{em.scenario}</p>
              <p><b>In your email, do the following:</b></p>
              <ul>
                {#each em.goals as g}
                  <li>{g}</li>
                {/each}
              </ul>
              <p class="ets-note">Write as much as you can to address all three points clearly and politely.</p>
            </div>
            <div class="ets-right-pane">
              <div class="email-header">
                <div><b>To:</b> {em.recipient}</div>
                <div><b>Subject:</b> {em.subject}</div>
              </div>
              <div class="editor-toolbar">
                <button class="ets-btn" onclick={() => (showWordCount = !showWordCount)}>
                  {showWordCount ? 'Hide Word Count' : 'Show Word Count'}
                </button>
                {#if showWordCount}
                  <span class="wc-stat">
                    Words: <b>{countWords(emailDraft)}</b> · Live Speed: <b>{emailWpm} WPM</b> · AWL words used:
                    <b>{detectAwlUsed(emailDraft).length}</b>
                  </span>
                {/if}
              </div>
              <textarea
                class="ets-editor"
                rows="14"
                placeholder="Write your email response here..."
                bind:value={emailDraft}
                oninput={updateEmailWpm}
              ></textarea>
            </div>
          </div>
        {:else if ws.kind === 'discussion'}
          {@const dc = currentTest.writing.discussion}
          <div class="ets-split-pane">
            <div class="ets-left-pane">
              <div class="ets-directions">
                <b>Write for an Academic Discussion</b> (Recommended time: {dc.recommendedMinutes} minutes)
              </div>
              <div class="prof-box">
                <div class="prof-meta"><b>Professor · {dc.course}</b></div>
                <p>{dc.professorPrompt}</p>
              </div>
              <div class="student-box">
                <b>{dc.studentA.name}:</b>
                <p>{dc.studentA.text}</p>
              </div>
              <div class="student-box">
                <b>{dc.studentB.name}:</b>
                <p>{dc.studentB.text}</p>
              </div>
            </div>
            <div class="ets-right-pane">
              <div class="editor-toolbar">
                <button class="ets-btn" onclick={() => (showWordCount = !showWordCount)}>
                  {showWordCount ? 'Hide Word Count' : 'Show Word Count'}
                </button>
                {#if showWordCount}
                  <span class="wc-stat">
                    Words: <b>{countWords(discussionDraft)}</b> (target 100+) · Live Speed: <b>{discWpm} WPM</b> · AWL words:
                    <b>{detectAwlUsed(discussionDraft).length}</b>
                  </span>
                {/if}
              </div>
              <textarea
                class="ets-editor"
                rows="16"
                placeholder="Type your contribution to the discussion..."
                bind:value={discussionDraft}
                oninput={updateDiscWpm}
              ></textarea>
            </div>
          </div>
        {/if}
      {:else if currentSection === 'speaking'}
        {@const ss = speakingSteps[stepIdx]}
        {#if ss.kind === 'repeat'}
          {@const lr = currentTest.speaking.listenRepeat[ss.idx]}
          <div class="ets-single-pane">
            <div class="ets-directions">
              <b>Listen and Repeat:</b> Listen to the speaker say a sentence, then record yourself repeating it accurately and
              naturally.
            </div>
            <div class="audio-card">
              <div>
                <h2>Sentence {ss.idx + 1} of {currentTest.speaking.listenRepeat.length}</h2>
                <p>Click Play Audio, listen carefully without text, and then record your repetition.</p>
              </div>
              <div class="speak-btns">
                <button class="ets-btn primary" onclick={() => playPromptAudio(lr.audioSrc)}>
                  ▶ Play Sentence Audio
                </button>
                <button
                  class="ets-btn record"
                  class:active={isRecording && activeRecordId === lr.id}
                  onclick={() => toggleRecording(lr.id)}
                >
                  {isRecording && activeRecordId === lr.id ? '■ Stop Recording' : '● Record Repetition'}
                </button>
              </div>
            </div>
            {#if micError}
              <p class="err-msg">{micError}</p>
            {/if}
            {#if recordings[lr.id]}
              <div class="playback-box">
                <b>Your Recorded Response:</b>
                <audio controls src={recordings[lr.id]}></audio>
              </div>
            {/if}
          </div>
        {:else}
          {@const turn = currentTest.speaking.interviewTurns[ss.idx]}
          <div class="ets-single-pane">
            <div class="ets-directions">
              <b>Take an Interview ({currentTest.speaking.interviewTopic}):</b> Listen to the interviewer’s question and
              respond for up to {turn.responseSeconds} seconds.
            </div>
            <div class="audio-card">
              <div>
                <h2>Interview Question {ss.idx + 1} of {currentTest.speaking.interviewTurns.length}</h2>
                <p>{turn.interviewerQuestion}</p>
              </div>
              <div class="speak-btns">
                <button class="ets-btn primary" onclick={() => playPromptAudio(turn.audioSrc)}>
                  ▶ Play Interviewer Audio
                </button>
                <button
                  class="ets-btn record"
                  class:active={isRecording && activeRecordId === turn.id}
                  onclick={() => toggleRecording(turn.id)}
                >
                  {isRecording && activeRecordId === turn.id ? '■ Stop Recording' : '● Record Answer (45s)'}
                </button>
              </div>
            </div>
            {#if micError}
              <p class="err-msg">{micError}</p>
            {/if}
            {#if recordings[turn.id]}
              <div class="playback-box">
                <b>Your Recorded Response:</b>
                <audio controls src={recordings[turn.id]}></audio>
              </div>
            {/if}
          </div>
        {/if}
      {/if}
    </div>
  </div>
{:else}
  <!-- Comprehensive Post-Exam Diagnostic & Score Report -->
  <section class="exam-review">
    <div class="card report-hero">
      <div>
        <span class="tag">Diagnostic Score Report · 2026 Band Scale (1.0–6.0)</span>
        <h1>{currentTest.title} — Results & Explanations</h1>
      </div>
      <div class="band-cards">
        <div class="band-pill">
          <span>Reading</span>
          <b>Band {scoreSummary.rBand.toFixed(1)}</b>
          <small>{scoreSummary.rCorrect} / {scoreSummary.rTotal} correct</small>
        </div>
        <div class="band-pill">
          <span>Listening</span>
          <b>Band {scoreSummary.lBand.toFixed(1)}</b>
          <small>{scoreSummary.lCorrect} / {scoreSummary.lTotal} correct</small>
        </div>
        <div class="band-pill">
          <span>Build a Sentence</span>
          <b>{scoreSummary.bsCorrect} / {scoreSummary.bsTotal}</b>
          <small>exact matches</small>
        </div>
      </div>
      <div class="report-actions">
        <button class="btn primary" onclick={exitExam}>Back to TOEFL Practice Lobby</button>
      </div>
    </div>

    <!-- Reading Explanations -->
    <div class="card">
      <h2>Reading Section Review</h2>
      {#each currentTest.reading.tasks as task}
        {#if task.kind === 'complete_words'}
          {@const blanks = parseCompleteWords(task.template).filter((x) => x.kind === 'blank')}
          {@const userArr = cwInputs[task.id] ?? []}
          <div class="review-block">
            <h3>Complete the Words: {task.topic}</h3>
            <div class="cw-review-grid">
              {#each blanks as b, i}
                {@const u = (userArr[i] ?? '').trim()}
                {@const ok = u.toLowerCase() === (b.answer ?? '').toLowerCase()}
                <div class="cw-rev-item" class:ok class:bad={!ok}>
                  <span>{b.prefix}<b>{b.answer}</b></span>
                  <small>Your entry: {u ? `${b.prefix}${u}` : '(blank)'}</small>
                </div>
              {/each}
            </div>
            <p class="sub">{task.explanation}</p>
          </div>
        {:else}
          <div class="review-block">
            <h3>{task.title}</h3>
            {#each task.questions as q}
              {@const picked = mcqAnswers[q.id]}
              {@const ok = picked === q.answer}
              <div class="q-rev-item">
                <p><b>{q.prompt}</b></p>
                <p class={ok ? 'good-txt' : 'bad-txt'}>
                  Your answer: {picked !== undefined ? q.options[picked] : '(unanswered)'}
                  {ok ? ' ✓' : ` ✗ (Correct: ${q.options[q.answer]})`}
                </p>
                <p class="sub">{q.explanation}</p>
              </div>
            {/each}
          </div>
        {/if}
      {/each}
    </div>

    <!-- Listening Explanations -->
    <div class="card">
      <h2>Listening Section Review & Transcripts</h2>
      {#each currentTest.listening.items as item}
        <div class="review-block">
          <div class="row-between">
            <h3>{item.title} ({item.speakerLabel})</h3>
            <button class="btn" onclick={() => playPromptAudio(item.audioSrc)}>▶ Play Audio</button>
          </div>
          <pre class="transcript-box">{item.transcript}</pre>
          {#each item.questions as q}
            {@const picked = mcqAnswers[q.id]}
            {@const ok = picked === q.answer}
            <div class="q-rev-item">
              <p><b>{q.prompt}</b></p>
              <p class={ok ? 'good-txt' : 'bad-txt'}>
                Your answer: {picked !== undefined ? q.options[picked] : '(unanswered)'}
                {ok ? ' ✓' : ` ✗ (Correct: ${q.options[q.answer]})`}
              </p>
              <p class="sub">{q.explanation}</p>
            </div>
          {/each}
        </div>
      {/each}
    </div>

    <!-- Writing Review + Typing Drill Bridge -->
    <div class="card">
      <h2>Writing Section Review & Model Responses</h2>

      <div class="review-block">
        <h3>Build a Sentence</h3>
        {#each currentTest.writing.buildSentences.items as bs}
          {@const endChar = bs.answer.trim().slice(-1)}
          {@const built = builtSentenceString(bs.id, bs.chunks, endChar)}
          {@const ok = built.toLowerCase() === bs.answer.toLowerCase()}
          <div class="q-rev-item">
            <p class="sub">{bs.context}</p>
            <p class={ok ? 'good-txt' : 'bad-txt'}>
              Your sentence: {built || '(none)'} {ok ? '✓' : '✗'}
            </p>
            <p><b>Target:</b> {bs.answer}</p>
            <p class="sub">{bs.explanation}</p>
          </div>
        {/each}
      </div>

      <div class="review-block">
        <div class="row-between">
          <h3>Write an Email — Comparison & Typing Speed Drill</h3>
          <button class="btn primary" onclick={() => sendModelToTypingDrill(currentTest.writing.email.modelAnswer)}>
            Type This Model Email in Speed Trainer →
          </button>
        </div>
        <p class="sub">
          Your draft: <b>{countWords(emailDraft)} words</b> ({emailWpm} WPM) · AWL words detected:
          <b>{detectAwlUsed(emailDraft).join(', ') || 'none'}</b>
        </p>
        <div class="compare-grid">
          <div>
            <h4>Your Submitted Email</h4>
            <pre class="transcript-box">{emailDraft || '(No response entered)'}</pre>
          </div>
          <div>
            <h4>Band 6.0 Model Response</h4>
            <pre class="transcript-box">{currentTest.writing.email.modelAnswer}</pre>
          </div>
        </div>
      </div>

      <div class="review-block">
        <div class="row-between">
          <h3>Write for an Academic Discussion — Comparison & Typing Drill</h3>
          <button class="btn primary" onclick={() => sendModelToTypingDrill(currentTest.writing.discussion.modelAnswer)}>
            Type This Model Discussion in Speed Trainer →
          </button>
        </div>
        <p class="sub">
          Your draft: <b>{countWords(discussionDraft)} words</b> ({discWpm} WPM) · AWL words detected:
          <b>{detectAwlUsed(discussionDraft).join(', ') || 'none'}</b>
        </p>
        <div class="compare-grid">
          <div>
            <h4>Your Submitted Post</h4>
            <pre class="transcript-box">{discussionDraft || '(No response entered)'}</pre>
          </div>
          <div>
            <h4>Band 6.0 Model Post</h4>
            <pre class="transcript-box">{currentTest.writing.discussion.modelAnswer}</pre>
          </div>
        </div>
      </div>
    </div>

    <!-- Speaking Review -->
    <div class="card">
      <h2>Speaking Section Review</h2>
      <div class="review-block">
        <h3>Listen and Repeat Sentences</h3>
        {#each currentTest.speaking.listenRepeat as lr, idx}
          <div class="q-rev-item">
            <p><b>#{idx + 1}:</b> “{lr.text}”</p>
            <div class="speak-rev-row">
              <button class="btn" onclick={() => playPromptAudio(lr.audioSrc)}>▶ Reference Audio</button>
              {#if recordings[lr.id]}
                <audio controls src={recordings[lr.id]}></audio>
              {:else}
                <span class="muted">(No recording saved)</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>

      <div class="review-block">
        <h3>Take an Interview ({currentTest.speaking.interviewTopic})</h3>
        {#each currentTest.speaking.interviewTurns as turn, idx}
          <div class="q-rev-item">
            <p><b>Question {idx + 1}:</b> {turn.interviewerQuestion}</p>
            <ul class="sub">
              {#each turn.samplePoints as pt}
                <li>{pt}</li>
              {/each}
            </ul>
            {#if recordings[turn.id]}
              <audio controls src={recordings[turn.id]}></audio>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </section>
{/if}

<style>
  .exam-lobby,
  .exam-review {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .hero {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1.25rem;
  }
  .tag {
    display: inline-block;
    background: var(--bg-3);
    color: var(--accent);
    font-size: 0.78rem;
    font-weight: 600;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    margin-bottom: 0.5rem;
  }
  .hero h1 {
    margin: 0 0 0.4rem;
    font-size: 1.65rem;
  }
  .hero p {
    margin: 0;
    max-width: 680px;
  }
  .lobby-actions {
    display: flex;
    gap: 0.65rem;
    flex-wrap: wrap;
  }
  .sections-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1rem;
  }
  .sec-card {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .sec-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .sec-head h3 {
    margin: 0;
    font-size: 1.05rem;
  }
  .badge {
    background: var(--bg-3);
    color: var(--sub);
    font-family: var(--font-mono);
    font-size: 0.78rem;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }
  .sec-card ul {
    margin: 0;
    padding-left: 1.15rem;
    color: var(--sub);
    font-size: 0.88rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .official-links h3 {
    margin: 0 0 0.35rem;
    font-size: 1.05rem;
  }
  .link-row {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
    margin-top: 0.6rem;
    font-size: 0.9rem;
  }

  /* Authentic ETS Test-Center Interface Styles */
  .ets-shell {
    min-height: 100vh;
    background: #f4f6f9;
    color: #1a212c;
    display: flex;
    flex-direction: column;
    font-family: 'Segoe UI', Arial, sans-serif;
  }
  .ets-bar {
    background: #0d3b66;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.65rem 1.4rem;
    border-bottom: 3px solid #f4b942;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .ets-brand {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }
  .ets-logo {
    background: #ffffff;
    color: #0d3b66;
    font-weight: 800;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    letter-spacing: 0.04em;
  }
  .ets-title {
    font-weight: 600;
    font-size: 0.98rem;
  }
  .ets-step {
    font-size: 0.92rem;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.12);
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
  }
  .ets-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .ets-timer {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-right: 0.5rem;
  }
  .clock {
    font-family: var(--font-mono);
    font-size: 1.05rem;
    font-weight: 700;
  }
  .clock.urgent {
    color: #ff9b85;
  }
  .ets-untimed {
    font-size: 0.82rem;
    opacity: 0.85;
    margin-right: 0.5rem;
  }
  .ets-btn {
    background: #e2e8f0;
    color: #0d3b66;
    border: 1px solid #cbd5e1;
    border-radius: 5px;
    padding: 0.38rem 0.85rem;
    font-weight: 600;
    font-size: 0.86rem;
  }
  .ets-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .ets-btn.primary {
    background: #f4b942;
    border-color: #d99b26;
    color: #112233;
  }
  .ets-btn.ghost {
    background: transparent;
    border-color: rgba(255, 255, 255, 0.35);
    color: #ffffff;
  }
  .ets-btn.exit {
    background: transparent;
    border-color: rgba(255, 255, 255, 0.4);
    color: #ffd6d6;
  }
  .ets-btn.record {
    background: #dc2626;
    border-color: #b91c1c;
    color: #ffffff;
  }
  .ets-btn.record.active {
    background: #7f1d1d;
  }
  .ets-stage {
    flex: 1;
    max-width: 1220px;
    width: 100%;
    margin: 0 auto;
    padding: 1.5rem;
  }
  .ets-single-pane {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 1.75rem;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  }
  .ets-split-pane {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
    min-height: 72vh;
  }
  @media (max-width: 860px) {
    .ets-split-pane {
      grid-template-columns: 1fr;
    }
  }
  .ets-left-pane,
  .ets-right-pane {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 1.5rem;
    overflow-y: auto;
  }
  .ets-directions {
    background: #edf2f7;
    border-left: 4px solid #0d3b66;
    padding: 0.65rem 0.9rem;
    font-size: 0.9rem;
    margin-bottom: 1.1rem;
  }
  .ets-passage-title {
    margin: 0 0 1rem;
    color: #0d3b66;
    font-size: 1.3rem;
  }
  .ets-para {
    line-height: 1.72;
    margin: 0 0 1rem;
    font-size: 0.98rem;
  }
  .para-num {
    color: #64748b;
    font-weight: 700;
    font-size: 0.82rem;
  }
  .cw-paragraph {
    line-height: 2.3;
    font-size: 1.05rem;
  }
  .cw-word {
    white-space: nowrap;
  }
  .cw-prefix {
    font-weight: 600;
    color: #0d3b66;
  }
  .cw-input {
    font-family: var(--font-mono);
    font-size: 1rem;
    border: none;
    border-bottom: 2px solid #0d3b66;
    background: #eef4fb;
    color: #0f172a;
    padding: 0.1rem 0.25rem;
  }
  .cw-len {
    color: #64748b;
    font-size: 0.75rem;
    margin-left: 2px;
  }
  .doc-frame {
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 1rem;
    background: #fafbfc;
  }
  .doc-badge,
  .discipline-tag,
  .audio-kind {
    display: inline-block;
    font-size: 0.72rem;
    font-weight: 700;
    color: #0d3b66;
    background: #e0ecf8;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    margin-bottom: 0.4rem;
  }
  .doc-meta {
    font-size: 0.84rem;
    color: #475569;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 0.5rem;
    margin-bottom: 0.75rem;
  }
  .doc-body {
    white-space: pre-wrap;
    font-family: inherit;
    line-height: 1.6;
    margin: 0;
  }
  .ets-q-prompt {
    font-weight: 700;
    font-size: 1.04rem;
    margin: 0 0 1rem;
  }
  .ets-options {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }
  .ets-option {
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    padding: 0.75rem 0.9rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    cursor: pointer;
    background: #ffffff;
  }
  .ets-option.selected {
    border-color: #0d3b66;
    background: #eef4fb;
  }
  .audio-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
    padding: 1.15rem;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    margin-bottom: 1.25rem;
  }
  .audio-card h2 {
    margin: 0.2rem 0;
    font-size: 1.15rem;
  }
  .audio-card p {
    margin: 0;
    color: #475569;
  }
  .audio-controls {
    display: flex;
    align-items: center;
    gap: 0.85rem;
  }
  .progress-bar {
    width: 140px;
    height: 8px;
    background: #cbd5e1;
    border-radius: 99px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: #0d3b66;
    transition: width 0.15s;
  }
  .bs-context {
    margin-bottom: 0.75rem;
  }
  .bs-preview {
    min-height: 3.4rem;
    padding: 0.85rem 1rem;
    border: 2px dashed #94a3b8;
    border-radius: 8px;
    background: #f8fafc;
    margin-bottom: 1rem;
    font-size: 1.08rem;
  }
  .bs-placeholder {
    color: #64748b;
  }
  .bs-built {
    font-weight: 600;
    color: #0d3b66;
  }
  .bs-chunks {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
    margin-bottom: 1rem;
  }
  .bs-chunk {
    background: #ffffff;
    border: 1px solid #0d3b66;
    color: #0d3b66;
    padding: 0.45rem 0.85rem;
    border-radius: 6px;
    font-weight: 600;
  }
  .bs-chunk.used {
    background: #0d3b66;
    color: #ffffff;
  }
  .email-header {
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    padding: 0.65rem 0.85rem;
    border-radius: 6px;
    font-size: 0.88rem;
    margin-bottom: 0.65rem;
  }
  .editor-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    font-size: 0.85rem;
  }
  .ets-editor {
    width: 100%;
    border: 1px solid #94a3b8;
    border-radius: 6px;
    padding: 0.75rem;
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 0.96rem;
    line-height: 1.55;
    background: #ffffff;
    color: #0f172a;
  }
  .prof-box,
  .student-box {
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 0.85rem;
    margin-bottom: 0.75rem;
    background: #f8fafc;
    font-size: 0.92rem;
  }
  .speak-btns {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
  }
  .playback-box {
    margin-top: 1rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .ets-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: grid;
    place-items: center;
    z-index: 40;
  }
  .ets-modal {
    background: #ffffff;
    color: #0f172a;
    border-radius: 8px;
    padding: 1.25rem;
    width: min(680px, 92vw);
    max-height: 80vh;
    overflow-y: auto;
  }
  .modal-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }
  .review-table {
    width: 100%;
    border-collapse: collapse;
  }
  .review-table th,
  .review-table td {
    padding: 0.5rem;
    border-bottom: 1px solid #e2e8f0;
    text-align: left;
  }

  /* Review Report Styles */
  .report-hero {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .band-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.85rem;
  }
  .band-pill {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .band-pill b {
    font-size: 1.5rem;
    color: var(--accent);
    font-family: var(--font-mono);
  }
  .review-block {
    border-top: 1px solid var(--border);
    padding-top: 1rem;
    margin-top: 1rem;
  }
  .cw-review-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 0.5rem;
    margin: 0.65rem 0;
  }
  .cw-rev-item {
    padding: 0.45rem 0.65rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    font-family: var(--font-mono);
    font-size: 0.85rem;
  }
  .cw-rev-item.ok {
    border-color: var(--good);
  }
  .cw-rev-item.bad {
    border-color: var(--bad);
  }
  .q-rev-item {
    margin: 0.75rem 0;
    padding: 0.65rem 0.85rem;
    background: var(--bg);
    border-radius: 8px;
  }
  .good-txt {
    color: var(--good);
    font-weight: 600;
  }
  .bad-txt {
    color: var(--bad);
    font-weight: 600;
  }
  .transcript-box {
    white-space: pre-wrap;
    background: var(--bg);
    border: 1px solid var(--border);
    padding: 0.85rem;
    border-radius: 8px;
    font-family: var(--font-ui);
    font-size: 0.9rem;
    line-height: 1.55;
  }
  .compare-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  @media (max-width: 780px) {
    .compare-grid {
      grid-template-columns: 1fr;
    }
  }
  .row-between {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.6rem;
  }
  .speak-rev-row {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    flex-wrap: wrap;
  }
</style>

