import { useState, useRef, useCallback, useEffect, MutableRefObject } from 'react';
import { generateSpeech, revokeAudioUrl } from '../services/ttsService';

export interface AudioSentence {
    id: number;
    sentence: string;
}

export interface UseAudioPlayerOptions {
    voiceName?: string;
}

export interface UseAudioPlayerReturn {
    // State
    isPlaying: boolean;
    audioProgress: number;
    
    // Actions
    speak: (sentence: AudioSentence | null) => Promise<void>;
    speakSlow: (sentence: AudioSentence | null, playbackRate?: number) => Promise<void>;
    stopAll: () => void;
    
    // Cache management
    preloadAudio: (sentence: AudioSentence) => Promise<string | null>;
    clearCache: () => void;
    
    // Thinking time tracking
    getThinkingGap: () => number;
    resetThinkingTimer: () => void;
    
    // Refs for cleanup
    isExiting: MutableRefObject<boolean>;
}

export function useAudioPlayer(options: UseAudioPlayerOptions = {}): UseAudioPlayerReturn {
    const { voiceName = 'Kore' } = options;
    
    // State
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioProgress, setAudioProgress] = useState(0);
    
    // Refs
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioCacheRef = useRef<Map<number, string>>(new Map());
    const isExitingRef = useRef<boolean>(false);
    const animationFrameRef = useRef<number | null>(null);
    const updateProgressRef = useRef<() => void>(() => {});
    const lastPauseRef = useRef<number>(0);

    // Smooth progress update using requestAnimationFrame
    const updateProgressSmooth = useCallback(() => {
        if (audioRef.current && !audioRef.current.paused) {
            if (audioRef.current.duration > 0) {
                setAudioProgress(audioRef.current.currentTime / audioRef.current.duration);
            }
            animationFrameRef.current = requestAnimationFrame(() => updateProgressRef.current());
        }
    }, []);

    // Keep ref updated with latest function
    updateProgressRef.current = updateProgressSmooth;

    const stopProgressAnimation = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
    }, []);

    // Stop all audio playback
    const stopAll = useCallback(() => {
        isExitingRef.current = true;
        stopProgressAnimation();
        if (audioRef.current) {
            // Remove event handlers before clearing to prevent spurious errors
            audioRef.current.onplay = null;
            audioRef.current.onended = null;
            audioRef.current.onerror = null;
            audioRef.current.pause();
            audioRef.current.src = '';
            audioRef.current = null;
        }
        speechSynthesis.cancel();
        setIsPlaying(false);
    }, [stopProgressAnimation]);

    // Preload audio for a sentence (returns URL)
    const preloadAudio = useCallback(async (sentence: AudioSentence): Promise<string | null> => {
        console.log('[AudioPlayer] preloadAudio called:', { id: sentence.id, sentence: sentence.sentence });
        
        if (audioCacheRef.current.has(sentence.id)) {
            console.log('[AudioPlayer] Using cached audio for id:', sentence.id);
            return audioCacheRef.current.get(sentence.id) || null;
        }

        try {
            console.log('[AudioPlayer] Generating TTS for:', sentence.sentence);
            const ttsResult = await generateSpeech({
                text: sentence.sentence,
                voiceName
            });
            const audioUrl = ttsResult.audioUrl;
            console.log('[AudioPlayer] TTS generated, caching with id:', sentence.id, 'source:', ttsResult.source);
            audioCacheRef.current.set(sentence.id, audioUrl);
            return audioUrl;
        } catch (error) {
            console.error(`Failed to generate audio for sentence ${sentence.id}:`, error);
            return null;
        }
    }, [voiceName]);

    // Clear all cached audio
    const clearCache = useCallback(() => {
        audioCacheRef.current.forEach(url => revokeAudioUrl(url));
        audioCacheRef.current = new Map();
    }, []);

    // Get thinking time gap since last audio ended
    const getThinkingGap = useCallback((): number => {
        if (lastPauseRef.current === 0) return 0;
        return Date.now() - lastPauseRef.current;
    }, []);

    // Reset thinking timer (call when you've recorded the gap)
    const resetThinkingTimer = useCallback(() => {
        lastPauseRef.current = 0;
    }, []);

    // Play audio with optional playback rate
    const playAudio = useCallback(async (
        sentence: AudioSentence | null, 
        playbackRate: number = 1.0
    ): Promise<void> => {
        if (!sentence || isExitingRef.current) return;

        console.log('[AudioPlayer] playAudio called:', { 
            id: sentence.id, 
            sentence: sentence.sentence, 
            playbackRate 
        });

        stopProgressAnimation();
        if (audioRef.current) {
            // Remove event handlers before clearing to prevent spurious errors
            audioRef.current.onplay = null;
            audioRef.current.onended = null;
            audioRef.current.onerror = null;
            audioRef.current.pause();
            audioRef.current.src = '';
            audioRef.current = null;
        }

        // Get from cache or fetch
        let cachedUrl = audioCacheRef.current.get(sentence.id);
        console.log('[AudioPlayer] Cache lookup for id:', sentence.id, 'found:', !!cachedUrl);

        if (!cachedUrl) {
            setIsPlaying(true);
            cachedUrl = await preloadAudio(sentence) || undefined;
            if (!cachedUrl || isExitingRef.current) {
                setIsPlaying(false);
                console.warn('Failed to generate audio for sentence');
                return;
            }
        }

        if (isExitingRef.current) return;

        console.log('[AudioPlayer] Playing audio for sentence:', sentence.sentence);
        const audio = new Audio(cachedUrl);
        audio.playbackRate = playbackRate;
        audioRef.current = audio;

        audio.onplay = () => {
            setIsPlaying(true);
            setAudioProgress(0);
            animationFrameRef.current = requestAnimationFrame(() => updateProgressRef.current());
        };
        
        audio.onended = () => {
            stopProgressAnimation();
            setIsPlaying(false);
            setAudioProgress(1);
            lastPauseRef.current = Date.now();
        };
        
        audio.onerror = (e) => {
            stopProgressAnimation();
            setIsPlaying(false);
            console.warn('Audio playback error:', audio.error?.message || 'Unknown error', e);
        };

        setIsPlaying(true);
        setAudioProgress(0);
        
        try {
            await audio.play();
            if (!animationFrameRef.current) {
                animationFrameRef.current = requestAnimationFrame(() => updateProgressRef.current());
            }
        } catch (err) {
            console.error("Playback error:", err);
            setIsPlaying(false);
            stopProgressAnimation();
        }
    }, [preloadAudio, stopProgressAnimation]);

    // Speak at normal speed
    const speak = useCallback(async (sentence: AudioSentence | null) => {
        await playAudio(sentence, 1.0);
    }, [playAudio]);

    // Speak at slow speed
    const speakSlow = useCallback(async (sentence: AudioSentence | null, playbackRate: number = 0.7) => {
        await playAudio(sentence, playbackRate);
    }, [playAudio]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopProgressAnimation();
            audioCacheRef.current.forEach(url => revokeAudioUrl(url));
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
            }
            speechSynthesis.cancel();
        };
    }, [stopProgressAnimation]);

    return {
        isPlaying,
        audioProgress,
        speak,
        speakSlow,
        stopAll,
        preloadAudio,
        clearCache,
        getThinkingGap,
        resetThinkingTimer,
        isExiting: isExitingRef
    };
}
