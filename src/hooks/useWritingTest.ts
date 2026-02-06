import { useCallback, useEffect, useRef, useState } from 'react';
import { TranslationPrompt, WritingTranslationResponse } from '../services/geminiService';

export interface WritingTestResponse extends WritingTranslationResponse {}

interface UseWritingTestProps {
    prompts: TranslationPrompt[];
    onComplete: (responses: WritingTestResponse[], prompts: TranslationPrompt[]) => void;
}

type WritingTestPhase = 'translation' | 'correction' | 'complete';

const normalizeText = (text: string): string => text.trim().replace(/\s+/g, ' ').toLowerCase();

export function useWritingTest({ prompts, onComplete }: UseWritingTestProps) {
    const [phase, setPhase] = useState<WritingTestPhase>('translation');
    const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
    const [currentTranslation, setCurrentTranslation] = useState('');
    const [translations, setTranslations] = useState<string[]>([]);
    const [translationTimes, setTranslationTimes] = useState<number[]>([]);
    const [errorIndices, setErrorIndices] = useState<number[]>([]);
    const [corrections, setCorrections] = useState<Record<number, string>>({});

    const promptStartTimeRef = useRef<number>(Date.now());
    const correctionStartTimeRef = useRef<number>(Date.now());

    const currentPrompt = prompts[currentPromptIndex] || null;
    const totalPrompts = prompts.length;

    useEffect(() => {
        setPhase('translation');
        setCurrentPromptIndex(0);
        setCurrentTranslation('');
        setTranslations(Array(prompts.length).fill(''));
        setTranslationTimes(Array(prompts.length).fill(0));
        setErrorIndices([]);
        setCorrections({});
        promptStartTimeRef.current = Date.now();
        correctionStartTimeRef.current = Date.now();
    }, [prompts]);

    useEffect(() => {
        setCurrentTranslation(translations[currentPromptIndex] || '');
        promptStartTimeRef.current = Date.now();
    }, [currentPromptIndex, translations]);

    const saveCurrentTranslation = useCallback(() => {
        if (currentPromptIndex < 0 || currentPromptIndex >= totalPrompts) {
            return;
        }

        const elapsed = Date.now() - promptStartTimeRef.current;

        setTranslations(prev => {
            const next = [...prev];
            while (next.length < totalPrompts) {
                next.push('');
            }
            next[currentPromptIndex] = currentTranslation;
            return next;
        });

        setTranslationTimes(prev => {
            const next = [...prev];
            while (next.length < totalPrompts) {
                next.push(0);
            }
            next[currentPromptIndex] = Math.max(next[currentPromptIndex] || 0, elapsed);
            return next;
        });

        promptStartTimeRef.current = Date.now();
    }, [currentPromptIndex, currentTranslation, totalPrompts]);

    const handleNextPrompt = useCallback(() => {
        saveCurrentTranslation();

        if (currentPromptIndex < totalPrompts - 1) {
            setCurrentPromptIndex(prev => prev + 1);
        }
    }, [currentPromptIndex, totalPrompts, saveCurrentTranslation]);

    const handlePreviousPrompt = useCallback(() => {
        saveCurrentTranslation();

        if (currentPromptIndex > 0) {
            setCurrentPromptIndex(prev => prev - 1);
        }
    }, [currentPromptIndex, saveCurrentTranslation]);

    const startCorrectionPhase = useCallback((indices: number[], translationSnapshot?: string[]) => {
        saveCurrentTranslation();

        const sourceTranslations = translationSnapshot || translations;

        const sanitized = Array.from(new Set(indices))
            .filter(index => Number.isInteger(index) && index >= 0 && index < totalPrompts)
            .sort((a, b) => a - b);

        setErrorIndices(sanitized);
        setCorrections(prev => {
            const next = { ...prev };
            sanitized.forEach(index => {
                if (typeof next[index] === 'undefined') {
                    next[index] = sourceTranslations[index] || '';
                }
            });
            return next;
        });

        correctionStartTimeRef.current = Date.now();
        setPhase('correction');
    }, [saveCurrentTranslation, totalPrompts, translations]);

    const updateCorrection = useCallback((index: number, value: string) => {
        setCorrections(prev => ({
            ...prev,
            [index]: value,
        }));
    }, []);

    const resetToTranslation = useCallback(() => {
        setPhase('translation');
        promptStartTimeRef.current = Date.now();
    }, []);

    const completeTest = useCallback(() => {
        const correctionElapsed = errorIndices.length > 0 ? Date.now() - correctionStartTimeRef.current : 0;
        const avgCorrectionTime = errorIndices.length > 0
            ? Math.round(correctionElapsed / errorIndices.length)
            : 0;

        const finalTranslations = [...translations];
        while (finalTranslations.length < totalPrompts) {
            finalTranslations.push('');
        }

        const responses: WritingTestResponse[] = prompts.map((prompt, index) => {
            const initialTranslation = finalTranslations[index] || '';
            const hasGrammarError = errorIndices.includes(index);
            const correctedTranslation = hasGrammarError
                ? (corrections[index] ?? initialTranslation)
                : initialTranslation;

            return {
                promptId: prompt.id,
                scenario: prompt.scenario,
                sourceText: prompt.sourceText,
                expectedTranslation: prompt.expectedTranslation,
                initialTranslation,
                correctedTranslation,
                hasGrammarError,
                isCorrected: hasGrammarError
                    ? normalizeText(correctedTranslation) !== normalizeText(initialTranslation)
                    : true,
                translationTimeMs: translationTimes[index] || 0,
                correctionTimeMs: hasGrammarError ? avgCorrectionTime : 0,
            };
        });

        setPhase('complete');
        onComplete(responses, prompts);
    }, [errorIndices, corrections, translations, totalPrompts, prompts, translationTimes, onComplete]);

    return {
        phase,
        currentPromptIndex,
        currentPrompt,
        totalPrompts,
        currentTranslation,
        setCurrentTranslation,
        translations,
        errorIndices,
        corrections,
        saveCurrentTranslation,
        handleNextPrompt,
        handlePreviousPrompt,
        startCorrectionPhase,
        updateCorrection,
        resetToTranslation,
        completeTest,
    };
}
