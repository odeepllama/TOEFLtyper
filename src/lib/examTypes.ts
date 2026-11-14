// Data structures for the 2026 TOEFL iBT practice environment.

export type SectionKind = 'reading' | 'listening' | 'writing' | 'speaking';

export interface CompleteWordsItem {
  id: string;
  kind: 'complete_words';
  topic: string;
  /**
   * Paragraph where missing letters are encoded as `pre[missing]` e.g. `archaeol[ogists]`.
   * The first sentence has no blanks, matching the 2026 ETS "Complete the Words" task.
   */
  template: string;
  explanation: string;
}

export interface McqQuestion {
  id: string;
  prompt: string;
  options: [string, string, string, string];
  answer: number; // 0..3
  explanation: string;
  highlightQuote?: string;
}

export interface DailyLifeReadingItem {
  id: string;
  kind: 'daily_life';
  docType: 'notice' | 'email' | 'message_chain' | 'schedule';
  title: string;
  meta: string;
  body: string;
  questions: McqQuestion[];
}

export interface AcademicPassageItem {
  id: string;
  kind: 'academic_passage';
  title: string;
  discipline: string;
  paragraphs: string[];
  questions: McqQuestion[];
}

export type ReadingTask = CompleteWordsItem | DailyLifeReadingItem | AcademicPassageItem;

export interface ListeningItem {
  id: string;
  kind: 'choose_response' | 'conversation' | 'announcement' | 'academic_talk';
  title: string;
  speakerLabel: string;
  audioSrc: string;
  transcript: string;
  questions: McqQuestion[];
}

export interface BuildSentencePrompt {
  id: string;
  context: string;
  chunks: string[];
  answer: string;
  explanation: string;
}

export interface WriteEmailItem {
  id: string;
  scenario: string;
  recipient: string;
  subject: string;
  goals: [string, string, string];
  recommendedMinutes: number;
  modelAnswer: string;
  rubricNotes: string[];
}

export interface AcademicDiscussionItem {
  id: string;
  course: string;
  professorPrompt: string;
  studentA: { name: string; text: string };
  studentB: { name: string; text: string };
  recommendedMinutes: number;
  modelAnswer: string;
  rubricNotes: string[];
}

export interface ListenRepeatSentence {
  id: string;
  text: string;
  audioSrc: string;
}

export interface InterviewTurn {
  id: string;
  interviewerQuestion: string;
  audioSrc: string;
  prepSeconds: number;
  responseSeconds: number;
  samplePoints: string[];
}

export interface MockTest {
  id: string;
  title: string;
  subtitle: string;
  reading: {
    durationSeconds: number;
    tasks: ReadingTask[];
  };
  listening: {
    durationSeconds: number;
    items: ListeningItem[];
  };
  writing: {
    buildSentences: {
      durationSeconds: number;
      items: BuildSentencePrompt[];
    };
    email: WriteEmailItem;
    discussion: AcademicDiscussionItem;
  };
  speaking: {
    listenRepeat: ListenRepeatSentence[];
    interviewTopic: string;
    interviewTurns: InterviewTurn[];
  };
}
