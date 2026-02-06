import { useState, useCallback, useRef, useEffect } from 'react';
import { TranslationPrompt, TranslationResponse, ConversationExchange } from '../services/geminiService';

export interface SpeakingTestResponse {
    translationResponses: TranslationResponse[];
    conversationTranscript: ConversationExchange[];
    totalTestTimeMs: number;
}

interface UseSpeakingTestProps {
    prompts: TranslationPrompt[];
    onComplete: (response: SpeakingTestResponse, prompts: TranslationPrompt[]) => void;
}

// Speech Recognition types
interface SpeechRecognitionEvent {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface SpeechRecognitionResultList {
    length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
    isFinal: boolean;
    length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}

export function useSpeakingTest({ prompts, onComplete }: UseSpeakingTestProps) {
    const [currentPhase, setCurrentPhase] = useState<'partA' | 'partB' | 'complete'>('partA');
    const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
    const [translationResponses, setTranslationResponses] = useState<TranslationResponse[]>([]);
    const [conversationExchanges, setConversationExchanges] = useState<ConversationExchange[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [currentTranscript, setCurrentTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');

    const promptStartTimeRef = useRef<number>(0);
    const testStartTimeRef = useRef<number>(Date.now());
    const recognitionRef = useRef<any>(null);

    const totalPrompts = prompts.length;
    const currentPrompt = prompts[currentPromptIndex] || null;

    // Initialize speech recognition
    const initRecognition = useCallback((lang: string) => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error('Speech Recognition API not supported');
            return null;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = lang;
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        return recognition;
    }, []);

    // Start recording
    const startRecording = useCallback((targetLanguage: string) => {
        const recognition = initRecognition(targetLanguage);
        if (!recognition) return;

        recognitionRef.current = recognition;
        setCurrentTranscript('');
        setInterimTranscript('');
        promptStartTimeRef.current = Date.now();

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let interim = '';
            let final = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    final += transcript;
                } else {
                    interim += transcript;
                }
            }

            if (final) {
                setCurrentTranscript(prev => prev + final);
            }
            setInterimTranscript(interim);
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            setIsRecording(false);
        };

        recognition.onend = () => {
            setIsRecording(false);
            setInterimTranscript('');
        };

        recognition.start();
        setIsRecording(true);
    }, [initRecognition]);

    // Stop recording
    const stopRecording = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        setIsRecording(false);
        setInterimTranscript('');
    }, []);

    // Save current translation response
    const saveTranslationResponse = useCallback((transcript: string) => {
        if (!currentPrompt) return;

        const responseTimeMs = Date.now() - promptStartTimeRef.current;

        const response: TranslationResponse = {
            promptId: currentPrompt.id,
            sourceText: currentPrompt.sourceText,
            expectedTranslation: currentPrompt.expectedTranslation,
            userTranscript: transcript,
            responseTimeMs,
        };

        setTranslationResponses(prev => {
            const existing = prev.findIndex(r => r.promptId === currentPrompt.id);
            if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = response;
                return updated;
            }
            return [...prev, response];
        });
    }, [currentPrompt]);

    // Navigate prompts
    const handleNextPrompt = useCallback(() => {
        // Save current transcript if any
        if (currentTranscript) {
            saveTranslationResponse(currentTranscript);
        }

        if (currentPromptIndex < totalPrompts - 1) {
            setCurrentPromptIndex(prev => prev + 1);
            setCurrentTranscript('');
            setInterimTranscript('');
        } else {
            // Part A complete, move to Part B
            setCurrentPhase('partB');
            setCurrentTranscript('');
            setInterimTranscript('');
        }
    }, [currentPromptIndex, totalPrompts, currentTranscript, saveTranslationResponse]);

    const handlePreviousPrompt = useCallback(() => {
        if (currentPromptIndex > 0) {
            // Save current transcript if any
            if (currentTranscript) {
                saveTranslationResponse(currentTranscript);
            }
            setCurrentPromptIndex(prev => prev - 1);
            setCurrentTranscript('');
            setInterimTranscript('');
        }
    }, [currentPromptIndex, currentTranscript, saveTranslationResponse]);

    // Add conversation exchange
    const addConversationExchange = useCallback((role: 'ai' | 'user', text: string) => {
        setConversationExchanges(prev => [
            ...prev,
            { role, text, timestamp: Date.now() }
        ]);
    }, []);

    // Complete the test
    const handleCompleteTest = useCallback(() => {
        const totalTestTimeMs = Date.now() - testStartTimeRef.current;

        const response: SpeakingTestResponse = {
            translationResponses,
            conversationTranscript: conversationExchanges,
            totalTestTimeMs,
        };

        setCurrentPhase('complete');
        onComplete(response, prompts);
    }, [translationResponses, conversationExchanges, prompts, onComplete]);

    // Skip Part B and complete
    const skipPartB = useCallback(() => {
        const totalTestTimeMs = Date.now() - testStartTimeRef.current;

        const response: SpeakingTestResponse = {
            translationResponses,
            conversationTranscript: [],
            totalTestTimeMs,
        };

        setCurrentPhase('complete');
        onComplete(response, prompts);
    }, [translationResponses, prompts, onComplete]);

    // Reset
    const reset = useCallback(() => {
        setCurrentPhase('partA');
        setCurrentPromptIndex(0);
        setTranslationResponses([]);
        setConversationExchanges([]);
        setIsRecording(false);
        setCurrentTranscript('');
        setInterimTranscript('');
        testStartTimeRef.current = Date.now();
    }, []);

    // Load existing response transcript when navigating back
    useEffect(() => {
        if (currentPrompt) {
            const existing = translationResponses.find(r => r.promptId === currentPrompt.id);
            if (existing) {
                setCurrentTranscript(existing.userTranscript);
            }
        }
    }, [currentPromptIndex, currentPrompt, translationResponses]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    return {
        currentPhase,
        setCurrentPhase,
        currentPromptIndex,
        currentPrompt,
        totalPrompts,
        translationResponses,
        conversationExchanges,
        isRecording,
        currentTranscript,
        interimTranscript,
        setCurrentTranscript,
        startRecording,
        stopRecording,
        saveTranslationResponse,
        handleNextPrompt,
        handlePreviousPrompt,
        addConversationExchange,
        handleCompleteTest,
        skipPartB,
        reset,
    };
}
