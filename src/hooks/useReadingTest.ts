import { useState, useCallback, useEffect } from 'react';
import { GeneratedPassage } from '../services/geminiService';

/**
 * Marked word data for reading assessment
 */
export interface MarkedWord {
    text: string;
    sentenceContext: string;
    paragraphIndex: number;
    wordIndices: number[];
    markedAt: number;
    type: 'word' | 'phrase';
}

/**
 * Marked sentence data for reading assessment
 */
export interface MarkedSentence {
    text: string;
    paragraphIndex: number;
    sentenceIndex: number;
    markedAt: number;
    reason?: 'grammar' | 'complexity' | 'vocabulary' | 'unknown';
}

/**
 * Test response data collected for each passage
 */
export interface ReadingTestResponse {
    passageId: string;
    passageTitle: string;
    content: string;
    difficulty: number;
    readingTimeMs: number;
    markedWords: MarkedWord[];
    markedSentences: MarkedSentence[];
    rereadCount: number; // Number of times user scrolled back up
}

interface UseReadingTestOptions {
    passages: GeneratedPassage[];
    onComplete: (responses: ReadingTestResponse[], passages: GeneratedPassage[]) => void;
}

/**
 * Hook for reading test logic with word and sentence marking.
 * Manages test state, time tracking, and marking collection.
 */
export function useReadingTest({
    passages,
    onComplete,
}: UseReadingTestOptions) {
    // Test state
    const [currentIndex, setCurrentIndex] = useState(0);
    const [responses, setResponses] = useState<ReadingTestResponse[]>([]);
    const [startTime, setStartTime] = useState<number>(Date.now());
    const [passageStartTime, setPassageStartTime] = useState<number>(Date.now());

    // Marking state
    const [markedWordIndices, setMarkedWordIndices] = useState<Set<number>>(new Set());
    const [markedSentenceIndices, setMarkedSentenceIndices] = useState<Set<number>>(new Set());
    const [markedWords, setMarkedWords] = useState<MarkedWord[]>([]);
    const [markedSentences, setMarkedSentences] = useState<MarkedSentence[]>([]);

    // Scroll tracking for re-reads
    const [scrollPosition, setScrollPosition] = useState(0);
    const [maxScrollPosition, setMaxScrollPosition] = useState(0);
    const [rereadCount, setRereadCount] = useState(0);

    const currentPassage = passages[currentIndex];

    // Track scroll position to detect re-reads
    const handleScroll = useCallback((scrollTop: number, scrollHeight: number) => {
        setScrollPosition(scrollTop);

        // If user scrolled back up significantly (more than 100px), count as re-read
        if (scrollTop < maxScrollPosition - 100) {
            setRereadCount(prev => prev + 1);
        }

        // Update max scroll position
        if (scrollTop > maxScrollPosition) {
            setMaxScrollPosition(scrollTop);
        }
    }, [maxScrollPosition]);

    // Toggle word mark by index
    const toggleWordMark = useCallback((index: number) => {
        setMarkedWordIndices(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    }, []);

    // Toggle word range (for phrase selection with Shift + Click)
    const toggleWordRange = useCallback((start: number, end: number) => {
        setMarkedWordIndices(prev => {
            const newSet = new Set(prev);
            const [min, max] = start < end ? [start, end] : [end, start];

            // Check if all words in range are marked
            let allMarked = true;
            for (let i = min; i <= max; i++) {
                if (!newSet.has(i)) {
                    allMarked = false;
                    break;
                }
            }

            // Toggle range
            for (let i = min; i <= max; i++) {
                if (allMarked) {
                    newSet.delete(i);
                } else {
                    newSet.add(i);
                }
            }

            return newSet;
        });
    }, []);

    // Toggle sentence mark
    const toggleSentenceMark = useCallback((sentenceIndex: number) => {
        setMarkedSentenceIndices(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sentenceIndex)) {
                newSet.delete(sentenceIndex);
            } else {
                newSet.add(sentenceIndex);
            }
            return newSet;
        });
    }, []);

    // Add marked word with context
    const addMarkedWord = useCallback((
        text: string,
        sentenceContext: string,
        paragraphIndex: number,
        wordIndices: number[],
        type: 'word' | 'phrase' = 'word'
    ) => {
        const markedWord: MarkedWord = {
            text,
            sentenceContext,
            paragraphIndex,
            wordIndices,
            markedAt: Date.now(),
            type,
        };

        setMarkedWords(prev => [...prev, markedWord]);

        // Also mark the word indices
        wordIndices.forEach(idx => {
            setMarkedWordIndices(prev => new Set(prev).add(idx));
        });
    }, []);

    // Add marked sentence
    const addMarkedSentence = useCallback((
        text: string,
        paragraphIndex: number,
        sentenceIndex: number,
        reason?: 'grammar' | 'complexity' | 'vocabulary' | 'unknown'
    ) => {
        const markedSentence: MarkedSentence = {
            text,
            paragraphIndex,
            sentenceIndex,
            markedAt: Date.now(),
            reason,
        };

        setMarkedSentences(prev => [...prev, markedSentence]);

        // Also mark the sentence index
        setMarkedSentenceIndices(prev => new Set(prev).add(sentenceIndex));
    }, []);

    // Remove marked word
    const removeMarkedWord = useCallback((index: number) => {
        setMarkedWords(prev => prev.filter((_, i) => i !== index));
    }, []);

    // Remove marked sentence
    const removeMarkedSentence = useCallback((index: number) => {
        setMarkedSentences(prev => prev.filter((_, i) => i !== index));
    }, []);

    // Clear all markings for current passage
    const clearAllMarkings = useCallback(() => {
        setMarkedWordIndices(new Set());
        setMarkedSentenceIndices(new Set());
        setMarkedWords([]);
        setMarkedSentences([]);
    }, []);

    // Move to next passage
    const handleNextPassage = useCallback(() => {
        if (!currentPassage) return;

        // Calculate reading time for this passage
        const readingTime = Date.now() - passageStartTime;

        // Create response for current passage
        const response: ReadingTestResponse = {
            passageId: currentPassage.id,
            passageTitle: currentPassage.title,
            content: currentPassage.content,
            difficulty: currentPassage.difficulty,
            readingTimeMs: readingTime,
            markedWords: [...markedWords],
            markedSentences: [...markedSentences],
            rereadCount,
        };

        const newResponses = [...responses, response];
        setResponses(newResponses);

        if (currentIndex < passages.length - 1) {
            // Move to next passage
            const nextIndex = currentIndex + 1;
            setCurrentIndex(nextIndex);

            // Reset for next passage
            clearAllMarkings();
            setPassageStartTime(Date.now());
            setScrollPosition(0);
            setMaxScrollPosition(0);
            setRereadCount(0);
        } else {
            // Test complete
            onComplete(newResponses, passages);
        }
    }, [
        currentPassage,
        currentIndex,
        passages,
        responses,
        markedWords,
        markedSentences,
        rereadCount,
        passageStartTime,
        onComplete,
        clearAllMarkings
    ]);

    // Move to previous passage
    const handlePreviousPassage = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);

            // Restore previous passage's markings if needed
            // For now, just reset
            clearAllMarkings();
            setPassageStartTime(Date.now());
            setScrollPosition(0);
            setMaxScrollPosition(0);
            setRereadCount(0);
        }
    }, [currentIndex, clearAllMarkings]);

    // Reset state when passages change
    const reset = useCallback(() => {
        setCurrentIndex(0);
        setResponses([]);
        setStartTime(Date.now());
        setPassageStartTime(Date.now());
        clearAllMarkings();
        setScrollPosition(0);
        setMaxScrollPosition(0);
        setRereadCount(0);
    }, [clearAllMarkings]);

    return {
        // State
        currentIndex,
        currentPassage,
        responses,
        markedWordIndices,
        markedSentenceIndices,
        markedWords,
        markedSentences,
        totalPassages: passages.length,

        // Scroll tracking
        scrollPosition,
        rereadCount,

        // Handlers
        toggleWordMark,
        toggleWordRange,
        toggleSentenceMark,
        addMarkedWord,
        addMarkedSentence,
        removeMarkedWord,
        removeMarkedSentence,
        clearAllMarkings,
        handleNextPassage,
        handlePreviousPassage,
        handleScroll,

        // Utils
        reset,
    };
}
