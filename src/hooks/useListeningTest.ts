import { useState, useCallback, useEffect, useRef } from 'react';
import { SliderValues, DEFAULT_SLIDER_VALUES } from '../components/listening/ListeningFeedbackSliders';
import { useAudioPlayer } from './useAudioPlayer';

/**
 * Generic sentence type for listening tests
 */
export interface TestSentence {
    id: number;
    sentence: string;
    difficulty: 'easy' | 'medium' | 'hard';
}

/**
 * Response data collected for each test sentence
 */
export interface TestResponseData {
    sentenceId?: number;
    sentence: string;
    understood: boolean;
    replays: number;
    reactionTimeMs: number;
    markedIndices: number[];
    wordBoundaries?: number;
    familiarity?: number;
    meaningClarity?: number;
    wordConfusion?: number;
}

interface UseListeningTestOptions {
    sentences: TestSentence[];
    onComplete: (responses: TestResponseData[]) => void;
    voiceName?: string;
    autoPlay?: boolean;
    includeSentenceId?: boolean;
}

/**
 * Shared hook for listening test logic used by MiniTest and LearningSession.
 * Manages test state, audio playback, word marking, and response collection.
 */
export function useListeningTest({
    sentences,
    onComplete,
    voiceName = 'Kore',
    autoPlay = true,
    includeSentenceId = true,
}: UseListeningTestOptions) {
    // Test state
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showTranscript, setShowTranscript] = useState(false);
    const [responses, setResponses] = useState<TestResponseData[]>([]);
    const [replays, setReplays] = useState(0);
    const [markedIndices, setMarkedIndices] = useState<Set<number>>(new Set());
    const [thinkingTimeSum, setThinkingTimeSum] = useState(0);

    // Slider state for "Not Sure" feedback
    const [showSliders, setShowSliders] = useState(false);
    const [sliderValues, setSliderValues] = useState<SliderValues>(DEFAULT_SLIDER_VALUES);

    // Audio player
    const audioPlayer = useAudioPlayer({ voiceName });
    const {
        isPlaying,
        audioProgress,
        speak,
        speakSlow,
        stopAll,
        preloadAudio,
        clearCache,
        getThinkingGap,
        resetThinkingTimer,
        isExiting
    } = audioPlayer;

    const currentSentence = sentences[currentIndex];

    // Play current sentence
    const playSentence = useCallback(async () => {
        if (!currentSentence || isExiting.current) return;

        const gap = getThinkingGap();
        if (gap > 0) {
            setThinkingTimeSum(prev => prev + gap);
            resetThinkingTimer();
        }

        await speak(currentSentence);
    }, [currentSentence, getThinkingGap, resetThinkingTimer, speak, isExiting]);

    // Replay handler
    const handleReplay = useCallback(() => {
        setReplays(prev => prev + 1);
        playSentence();
    }, [playSentence]);

    // Slow play handler
    const handleSlowPlay = useCallback(async () => {
        setReplays(prev => prev + 1);
        if (!currentSentence || isExiting.current) return;

        const gap = getThinkingGap();
        if (gap > 0) {
            setThinkingTimeSum(prev => prev + gap);
            resetThinkingTimer();
        }

        await speakSlow(currentSentence, 0.7);
    }, [currentSentence, getThinkingGap, resetThinkingTimer, speakSlow, isExiting]);

    // Toggle word mark
    const toggleWordMark = useCallback((index: number) => {
        setMarkedIndices(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    }, []);

    // Record final thinking time before revealing transcript
    const revealTranscript = useCallback(() => {
        const gap = getThinkingGap();
        if (gap > 0) {
            setThinkingTimeSum(prev => prev + gap);
            resetThinkingTimer();
        }
        setShowTranscript(true);
    }, [getThinkingGap, resetThinkingTimer]);

    // Handle "Not Sure" click - show sliders
    const handleNotSure = useCallback(() => {
        setShowSliders(true);
    }, []);

    // Handle response submission
    const handleResponse = useCallback(async (understood: boolean, sliderData?: SliderValues) => {
        const responseData: TestResponseData = {
            ...(includeSentenceId && { sentenceId: currentSentence.id }),
            sentence: currentSentence.sentence,
            understood,
            replays,
            reactionTimeMs: thinkingTimeSum,
            markedIndices: Array.from(markedIndices),
            ...(sliderData?.wordBoundaries !== null && sliderData?.wordBoundaries !== undefined && { wordBoundaries: sliderData.wordBoundaries }),
            ...(sliderData?.familiarity !== null && sliderData?.familiarity !== undefined && { familiarity: sliderData.familiarity }),
            ...(sliderData?.meaningClarity !== null && sliderData?.meaningClarity !== undefined && { meaningClarity: sliderData.meaningClarity }),
            ...(sliderData?.wordConfusion !== null && sliderData?.wordConfusion !== undefined && { wordConfusion: sliderData.wordConfusion }),
        };

        const newResponses = [...responses, responseData];
        setResponses(newResponses);

        // Reset slider state
        setShowSliders(false);
        setSliderValues(DEFAULT_SLIDER_VALUES);

        if (currentIndex < sentences.length - 1) {
            // Move to next question
            const nextIndex = currentIndex + 1;
            setCurrentIndex(nextIndex);
            setShowTranscript(false);
            setReplays(0);
            setMarkedIndices(new Set());
            setThinkingTimeSum(0);
            resetThinkingTimer();

            // Pre-fetch next audio
            if (nextIndex + 1 < sentences.length) {
                preloadAudio(sentences[nextIndex + 1]);
            }
        } else {
            // Test complete
            stopAll();
            onComplete(newResponses);
        }
    }, [
        currentSentence,
        currentIndex,
        sentences,
        responses,
        replays,
        thinkingTimeSum,
        markedIndices,
        includeSentenceId,
        resetThinkingTimer,
        preloadAudio,
        stopAll,
        onComplete
    ]);

    // Submit slider values
    const handleSliderSubmit = useCallback(() => {
        handleResponse(false, sliderValues);
    }, [handleResponse, sliderValues]);

    // Auto-play on new sentence
    useEffect(() => {
        if (currentSentence && autoPlay && !isExiting.current) {
            const timer = setTimeout(() => {
                if (!isExiting.current) {
                    playSentence();
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [currentIndex, autoPlay, currentSentence, playSentence, isExiting]);

    // Reset state when sentences change
    const reset = useCallback(() => {
        setCurrentIndex(0);
        setShowTranscript(false);
        setResponses([]);
        setReplays(0);
        setMarkedIndices(new Set());
        setThinkingTimeSum(0);
        setShowSliders(false);
        setSliderValues(DEFAULT_SLIDER_VALUES);
        clearCache();
        isExiting.current = false;
    }, [clearCache, isExiting]);

    return {
        // State
        currentIndex,
        currentSentence,
        showTranscript,
        responses,
        replays,
        markedIndices,
        showSliders,
        sliderValues,

        // Audio state
        isPlaying,
        audioProgress,

        // Handlers
        playSentence,
        handleReplay,
        handleSlowPlay,
        toggleWordMark,
        revealTranscript,
        handleNotSure,
        handleResponse,
        handleSliderSubmit,
        setSliderValues,

        // Utils
        reset,
        stopAll,
        preloadAudio,
        clearCache,
        isExiting,
    };
}
