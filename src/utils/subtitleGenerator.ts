import { Subtitle, WordTiming } from '../types';

/**
 * Split text into sentences based on punctuation
 */
export function splitIntoSentences(text: string): string[] {
  // Remove speaker prefix if present (e.g., "Speaker: ")
  const cleanText = text.replace(/^[^:]+:\s*/, '');
  
  // Split on sentence boundaries (. ! ? followed by space or end)
  const sentences = cleanText
    .split(/([.!?]+)(?:\s+|$)/)
    .reduce((acc: string[], part, i, arr) => {
      if (i % 2 === 0 && part.trim()) {
        // Combine sentence with its punctuation
        const punctuation = arr[i + 1] || '';
        acc.push((part + punctuation).trim());
      }
      return acc;
    }, [])
    .filter(s => s.length > 0);
  
  return sentences.length > 0 ? sentences : [cleanText];
}

/**
 * Generate subtitles from word-level timings (Google Cloud TTS)
 */
export function generateSubtitlesFromWordTimings(
  text: string,
  wordTimings: WordTiming[],
  baseId: string
): Subtitle[] {
  const sentences = splitIntoSentences(text);
  const subtitles: Subtitle[] = [];
  
  let wordIndex = 0;
  
  sentences.forEach((sentence, sentenceIndex) => {
    const words = sentence.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    
    if (wordIndex + wordCount > wordTimings.length) {
      console.warn(`Not enough word timings for sentence: "${sentence}"`);
      return;
    }
    
    const firstWord = wordTimings[wordIndex];
    const lastWord = wordTimings[wordIndex + wordCount - 1];
    
    subtitles.push({
      id: `${baseId}-${sentenceIndex}`,
      start: firstWord.start,
      end: lastWord.end,
      text: sentence
    });
    
    wordIndex += wordCount;
  });
  
  return subtitles;
}

/**
 * Generate subtitles from actual audio duration (Gemini TTS fallback)
 */
export function generateSubtitlesFromDuration(
  text: string,
  duration: number,
  baseId: string
): Subtitle[] {
  const sentences = splitIntoSentences(text);
  const totalWords = text.split(/\s+/).length;
  const wordsPerSecond = totalWords / duration;
  
  const subtitles: Subtitle[] = [];
  let currentTime = 0;
  
  sentences.forEach((sentence, index) => {
    const wordCount = sentence.split(/\s+/).length;
    const sentenceDuration = Math.max(1.0, wordCount / wordsPerSecond);
    
    subtitles.push({
      id: `${baseId}-${index}`,
      start: currentTime,
      end: currentTime + sentenceDuration,
      text: sentence
    });
    
    currentTime += sentenceDuration;
  });
  
  return subtitles;
}

/**
 * Combine multiple subtitle arrays with time offsets
 */
export function combineSubtitles(
  subtitleArrays: Subtitle[][],
  audioDurations: number[]
): Subtitle[] {
  const combined: Subtitle[] = [];
  let cumulativeTime = 0;
  
  subtitleArrays.forEach((subs, arrayIndex) => {
    subs.forEach(sub => {
      combined.push({
        ...sub,
        start: sub.start + cumulativeTime,
        end: sub.end + cumulativeTime
      });
    });
    
    cumulativeTime += audioDurations[arrayIndex] || 0;
  });
  
  return combined;
}

export interface RescaleOptions {
  offsetSeconds?: number;
  anchor?: 'start' | 'zero';
  minDurationSeconds?: number;
  clampToDuration?: boolean;
}

export interface RescaleResult {
  subtitles: Subtitle[];
  scale: number;
  offset: number;
  anchor: number;
  duration: number;
  changed: boolean;
}

/**
 * Rescale subtitle timings to match audio duration
 * Preserves existing segmentation and relative spacing
 */
export function rescaleSubtitlesToDuration(
  subtitles: Subtitle[],
  audioDuration: number,
  options: RescaleOptions = {}
): RescaleResult {
  const validSubs = subtitles.filter(
    (sub) => Number.isFinite(sub.start) && Number.isFinite(sub.end) && sub.end > sub.start
  );

  if (validSubs.length === 0 || !Number.isFinite(audioDuration) || audioDuration <= 0) {
    return {
      subtitles,
      scale: 1,
      offset: 0,
      anchor: 0,
      duration: audioDuration,
      changed: false,
    };
  }

  const firstStart = validSubs.reduce((min, sub) => Math.min(min, sub.start), validSubs[0].start);
  const lastEnd = validSubs.reduce((max, sub) => Math.max(max, sub.end), validSubs[0].end);

  const anchor = options.anchor === 'zero' ? 0 : firstStart;
  const denominator = lastEnd - anchor;

  if (!Number.isFinite(denominator) || denominator <= 0) {
    return {
      subtitles,
      scale: 1,
      offset: 0,
      anchor,
      duration: audioDuration,
      changed: false,
    };
  }

  const scale = (audioDuration - anchor) / denominator;

  if (!Number.isFinite(scale) || scale <= 0) {
    return {
      subtitles,
      scale: 1,
      offset: 0,
      anchor,
      duration: audioDuration,
      changed: false,
    };
  }

  const offset = options.offsetSeconds ?? 0;
  const minDuration = options.minDurationSeconds ?? 0.08;
  const clampToDuration = options.clampToDuration ?? true;

  const rescaled = subtitles.map((sub) => {
    if (!Number.isFinite(sub.start) || !Number.isFinite(sub.end)) {
      return sub;
    }

    const rawStart = anchor + (sub.start - anchor) * scale + offset;
    const rawEnd = anchor + (sub.end - anchor) * scale + offset;

    let start = Math.max(0, rawStart);
    let end = Math.max(start + minDuration, rawEnd);

    if (clampToDuration && Number.isFinite(audioDuration)) {
      if (end > audioDuration) {
        end = audioDuration;
      }
      if (start > audioDuration - minDuration) {
        start = Math.max(0, audioDuration - minDuration);
      }
      if (end < start + minDuration) {
        end = Math.min(audioDuration, start + minDuration);
      }
    }

    return {
      ...sub,
      start,
      end,
    };
  });

  const changed = Math.abs(scale - 1) > 0.001 || Math.abs(offset) > 0.001;

  return {
    subtitles: rescaled,
    scale,
    offset,
    anchor,
    duration: audioDuration,
    changed,
  };
}
