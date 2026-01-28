export interface Subtitle {
  id: string;
  start: number;
  end: number;
  text: string;
}

export interface FocusedSegment {
  start: number;
  end: number;
  text: string;
  subtitleId?: string;
}

export type Module = 'listening' | 'reading' | 'speaking' | 'writing';

export type Theme = 'dark' | 'light';

export type View = 'home' | 'loop' | 'vocab' | 'flashcards' | 'history' | 'learning' | 'assessment' | 'minitest' | 'generator' | 'scenario' | 'correction' | 'reader' | 'conversation' | 'writer' | 'library' | 'compose' | 'feedback';

export type TagType = 'too-fast' | 'unclear' | 'accent' | 'grammar' | 'vocabulary';

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
  transcript: Array<{ role: string; content: string }>;
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
  createdAt: number;
}

export interface ListeningFeedbackSession {
  id: string;
  videoId: string;
  videoTitle: string;
  markers: Marker[];
  feedback?: any;
  contextId?: string;
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
