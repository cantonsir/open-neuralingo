export interface Subtitle {
  id: string;
  start: number;
  end: number;
  text: string;
}

export interface WordTiming {
  word: string;
  start: number;  // seconds
  end: number;    // seconds
}

export interface TTSResult {
  audioUrl: string;
  duration?: number;
  subtitles?: Subtitle[];
  wordTimings?: WordTiming[];  // For Cloud TTS
  source: 'cloud-tts' | 'gemini-tts';
  accuracy: 'word-level' | 'speech-recognition' | 'duration-based' | 'estimated';
}

export interface FocusedSegment {
  start: number;
  end: number;
  text: string;
  subtitleId?: string;
}

export type Module = 'listening' | 'reading' | 'speaking' | 'writing';

export type Theme = 'dark' | 'light';

export type View = 'home' | 'loop' | 'vocab' | 'flashcards' | 'history' | 'learning' | 'assessment' | 'minitest' | 'generator' | 'scenario' | 'correction' | 'reader' | 'conversation' | 'writer' | 'library' | 'compose';

export type PracticeMode = 'loop' | 'shadow';

export type TagType = 'too-fast' | 'unclear' | 'accent' | 'grammar' | 'vocabulary' | 'shadow';

// Anki-style card states
export type CardState = 'new' | 'learning' | 'review' | 'relearning';

// Sort options for flashcard review
export type SortOption = 'due_first' | 'random' | 'newest' | 'oldest';

// Rating options for review
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export interface Marker {
  id: string;
  videoId?: string;
  start: number;
  end: number;
  createdAt: number;
  subtitleText?: string;
  tags: TagType[];
  note?: string;
  pressCount?: number;
  misunderstoodIndices?: number[];
  vocabData?: Record<number, VocabData>;
  source?: 'loop' | 'shadow';
  // SM-2 SRS fields
  easeFactor?: number;
  interval?: number;
  repetitions?: number;
  nextReviewDate?: string;
  lastReviewedAt?: number;
  customTags?: string[];
  // Anki-style card state fields
  cardState?: CardState;
  learningStep?: number;
  dueTimestamp?: number;
  // Preview intervals (populated by API)
  previewIntervals?: IntervalsPreview;
}

export interface SrsStats {
  total: number;
  new: number;
  learning: number;
  review: number;
  dueToday: number;
  mastered: number;
  averageEaseFactor: number;
}

export interface IntervalPreview {
  days?: number;
  seconds?: number;
  display: string;
}

export interface IntervalsPreview {
  again: IntervalPreview;
  hard: IntervalPreview;
  good: IntervalPreview;
  easy: IntervalPreview;
}

// Learning status for pending learning/relearning cards
export interface LearningStatus {
  learningCount: number;
  relearningCount: number;
  pendingCount: number;
  dueNowCount: number;
  nextDueIn: number | null;  // seconds until next due
  nextDueTimestamp: number | null;  // Unix ms timestamp
}

export interface ForecastDay {
  date: string;
  dayOffset: number;
  dueCount: number;
  newCount: number;
  reviewCount: number;
}

export interface ForecastResponse {
  forecast: ForecastDay[];
  totalDue: number;
  daysAhead: number;
}

export interface StudyStats {
  today: {
    again: number;
    hard: number;
    good: number;
    easy: number;
    total: number;
  };
  retention: number;
  streak: number;
  totalReviewsInPeriod: number;
  history: Array<{
    date: string;
    total: number;
    again: number;
    passed: number;
  }>;
}

export interface ReviewLogEntry {
  reviewedAt: number;
  rating: ReviewRating;
  stateBefore: CardState;
  stateAfter: CardState;
  intervalBefore: number;
  intervalAfter: number;
  easeBefore: number;
  easeAfter: number;
  timeTakenMs?: number;
}

export interface VocabData {
  definition: string;
  notes: string;
}

export interface PlayerState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackRate: number;
}

// Assessment Types
export interface AssessmentProfile {
  id: string;
  targetLanguage: string;
  targetContent: string;
  listeningLevel: number;
  subtitleDependence: number;
  difficulties: string[];
  updatedAt: number;
}

export interface TestResponse {
  sentenceId: number;
  sentence: string;
  understood: boolean;
  replays: number;
  reactionTimeMs: number;
  markedIndices: number[];
}

export interface TestAnalysis {
  overallLevel?: string;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
  summary?: string;
}

export interface TestResult {
  id: string;
  takenAt: number;
  score: number;
  totalQuestions: number;
  analysis: TestAnalysis | null;
  responses: TestResponse[];
}

// Speaking & Writing Session Types
export interface SpeakingSession {
  id: string;
  topic: string;
  transcript: Array<{ role: string; text: string }>;
  durationSeconds: number;
  createdAt: number;
}

export interface WritingSession {
  id: string;
  topic: string;
  content: string;
  contextId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ListeningSession {
  id: string;
  prompt: string;
  audioUrl: string;
  transcript: Array<{ speaker: string; text: string }>;
  durationSeconds: number;
  contextId?: string;
  subtitles?: Subtitle[];
  createdAt: number;
}

export interface ReadingSession {
  id: string;
  prompt: string;
  title: string;
  content: string;
  contextId?: string;
  createdAt: number;
}

export interface LibraryItem {
  id: string;
  title: string;
}

// Google Developers YouTube API Demo Video (Extremely stable for testing)
export const DEMO_VIDEO_ID = "M7lc1UVf-VE";

export const DEMO_SUBTITLES = `
WEBVTT

00:00:00.000 --> 00:00:03.000
This is a test of the YouTube Embedded Player.

00:00:03.500 --> 00:00:08.000
The video you are watching is used to verify API functionality.

00:00:08.500 --> 00:00:12.000
If you can see this video and read these captions...

00:00:12.500 --> 00:00:15.000
...then the EchoLoop application is working correctly!

00:00:16.000 --> 00:00:20.000
Try pressing SPACE now to create a marker.

00:00:21.000 --> 00:00:25.000
You can loop this section to practice your listening skills.
`;
