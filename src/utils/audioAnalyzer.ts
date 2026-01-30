import { WordTiming, Subtitle } from '../types';

/**
 * Get audio duration using HTML5 Audio API
 */
export async function getAudioDuration(audioUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(audioUrl);
    
    audio.addEventListener('loadedmetadata', () => {
      resolve(audio.duration);
    });
    
    audio.addEventListener('error', (e) => {
      reject(new Error(`Failed to load audio: ${e}`));
    });
    
    audio.load();
  });
}

/**
 * Attempt to get word-level timings using Web Speech Recognition API
 * Falls back to null if not supported or fails
 */
export async function getWordTimingsFromSpeechRecognition(
  audioUrl: string,
  expectedText: string
): Promise<WordTiming[] | null> {
  // Check if Speech Recognition is supported
  const SpeechRecognition = (window as any).SpeechRecognition || 
                           (window as any).webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    console.warn('Speech Recognition API not supported');
    return null;
  }
  
  try {
    return await new Promise<WordTiming[] | null>((resolve) => {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      
      const timings: WordTiming[] = [];
      const startTime = performance.now();
      
      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          
          if (result.isFinal) {
            const transcript = result[0].transcript.trim();
            const words = transcript.split(/\s+/);
            const currentTime = (performance.now() - startTime) / 1000;
            
            // Estimate timing for each word in this chunk
            const timePerWord = currentTime / (timings.length + words.length);
            
            words.forEach((word, idx) => {
              const wordStart = currentTime - (words.length - idx) * timePerWord;
              timings.push({
                word,
                start: wordStart,
                end: wordStart + timePerWord
              });
            });
          }
        }
      };
      
      recognition.onerror = () => {
        resolve(null);
      };
      
      recognition.onend = () => {
        resolve(timings.length > 0 ? timings : null);
      };
      
      // Load and play audio through recognition
      const audio = new Audio(audioUrl);
      audio.oncanplaythrough = () => {
        recognition.start();
        audio.play();
      };
      
      audio.onended = () => {
        recognition.stop();
      };
      
      // Timeout after 30 seconds
      setTimeout(() => {
        recognition.stop();
        audio.pause();
        resolve(null);
      }, 30000);
    });
  } catch (error) {
    console.warn('Speech recognition failed:', error);
    return null;
  }
}

/**
 * Smart timing analysis for Gemini TTS
 * Tries Speech Recognition first, falls back to duration-based estimation
 */
export async function analyzeAudioForSubtitles(
  audioUrl: string,
  text: string,
  baseId: string,
  useSpeechRecognition: boolean = false
): Promise<{ subtitles: Subtitle[]; accuracy: string }> {
  if (useSpeechRecognition) {
    // First attempt: Speech Recognition (most accurate)
    const wordTimings = await getWordTimingsFromSpeechRecognition(audioUrl, text);

    if (wordTimings && wordTimings.length > 0) {
      const { generateSubtitlesFromWordTimings } = await import('./subtitleGenerator');
      return {
        subtitles: generateSubtitlesFromWordTimings(text, wordTimings, baseId),
        accuracy: 'speech-recognition'
      };
    }
  }

  // Duration-based estimation (no playback side effects)
  try {
    const duration = await getAudioDuration(audioUrl);
    const { generateSubtitlesFromDuration } = await import('./subtitleGenerator');

    return {
      subtitles: generateSubtitlesFromDuration(text, duration, baseId),
      accuracy: 'duration-based'
    };
  } catch (error) {
    console.error('Failed to analyze audio:', error);
    throw error;
  }
}
