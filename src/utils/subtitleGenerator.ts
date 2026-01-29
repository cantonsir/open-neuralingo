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
