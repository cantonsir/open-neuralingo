import React, { useState, useEffect, useRef } from 'react';
import {
    Play,
    RotateCcw,
    Volume2,
    ChevronRight,
    Check,
    HelpCircle,
    Loader2,
    Trophy,
    Target,
    Zap,
    TrendingUp
} from 'lucide-react';
import { generateTestSentences, TestSentence, analyzeListeningResults, TestResult, ListeningAnalysis } from '../services/geminiService';
import { generateSpeech, revokeAudioUrl } from '../services/ttsService';

interface AssessmentResult {
    targetLanguage: string;
    targetContent: string;
    listeningLevel: number;
    subtitleDependence: number;
    difficulties: string[];
}

interface TestResponseData {
    sentenceId: number;
    sentence: string;
    understood: boolean;
    replays: number;
    reactionTimeMs: number;
    markedIndices: number[];
}

interface MiniTestProps {
    onComplete: () => void;
    onBack: () => void;
}

export default function MiniTest({ onComplete, onBack }: MiniTestProps) {
    const [loading, setLoading] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0, phase: 'sentences' as 'sentences' | 'audio' | 'analyzing' });
    const [sentences, setSentences] = useState<TestSentence[]>([]);
    const [audioCache, setAudioCache] = useState<Map<number, string>>(new Map());
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showTranscript, setShowTranscript] = useState(false);
    const [responses, setResponses] = useState<TestResponseData[]>([]);
    const [replays, setReplays] = useState(0);
    const [markedIndices, setMarkedIndices] = useState<Set<number>>(new Set()); // word indices
    const [isPlaying, setIsPlaying] = useState(false);
    const [testComplete, setTestComplete] = useState(false);
    const [analysis, setAnalysis] = useState<ListeningAnalysis | null>(null);
    const [thinkingTimeSum, setThinkingTimeSum] = useState<number>(0);
    const lastPauseRef = useRef<number>(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Helper to fetch and cache audio for a specific index
    const fetchAudioForIndex = async (index: number, sentencesList: TestSentence[]) => {
        if (index < 0 || index >= sentencesList.length) return null;
        const sentence = sentencesList[index];

        // Return existing if already cached
        if (audioCache.has(sentence.id)) return audioCache.get(sentence.id);

        try {
            const audioUrl = await generateSpeech({
                text: sentence.sentence,
                voiceName: 'Kore'
            });
            setAudioCache(prev => {
                const newCache = new Map(prev);
                newCache.set(sentence.id, audioUrl);
                return newCache;
            });
            return audioUrl;
        } catch (error) {
            console.error(`Failed to fetch audio for index ${index}:`, error);
            return null;
        }
    };

    // Load assessment and generate sentences
    useEffect(() => {
        const loadTest = async () => {
            // 1. Get assessment
            const stored = localStorage.getItem('assessment_result');
            const assessment: AssessmentResult = stored
                ? JSON.parse(stored)
                : { targetLanguage: 'en', targetContent: 'movies', listeningLevel: 2, subtitleDependence: 1, difficulties: [] };

            // 2. Generate sentences
            setLoadingProgress({ current: 0, total: 0, phase: 'sentences' });
            const generatedSentences = await generateTestSentences(assessment);
            setSentences(generatedSentences);

            // 3. JIT: Only generate the first audio upfront
            setLoadingProgress({ current: 0, total: 1, phase: 'audio' });

            if (generatedSentences.length > 0) {
                const firstId = generatedSentences[0].id;
                try {
                    const audioUrl = await generateSpeech({
                        text: generatedSentences[0].sentence,
                        voiceName: 'Kore'
                    });
                    setAudioCache(new Map([[firstId, audioUrl]]));

                    // Pre-fetch the second one in the background
                    if (generatedSentences.length > 1) {
                        fetchAudioForIndex(1, generatedSentences);
                    }
                } catch (error) {
                    console.error("Failed to generate first audio:", error);
                }
            }

            setLoading(false);
            // Thinking time model: clock will start via onended after audio plays
        };

        loadTest();

        // Cleanup all cached audio URLs on unmount
        return () => {
            audioCache.forEach(url => revokeAudioUrl(url));
            if (audioRef.current) {
                audioRef.current.pause();
            }
        };
    }, []);

    const currentSentence = sentences[currentIndex];

    // Play audio from cache or fetch on-demand
    const speak = async () => {
        if (!currentSentence) return;

        // Stop any current audio
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }

        let cachedUrl = audioCache.get(currentSentence.id);

        // If not in cache, fetch it now (fallback/JIT)
        if (!cachedUrl) {
            setIsPlaying(true); // Show animation while fetching
            cachedUrl = await fetchAudioForIndex(currentIndex, sentences) || undefined;
            if (!cachedUrl) {
                setIsPlaying(false);
                fallbackSpeak(currentSentence.sentence);
                return;
            }
        }

        // If we were in a "thinking" pause, add that silence gap to the sum
        if (lastPauseRef.current !== 0) {
            const silenceGap = Date.now() - lastPauseRef.current;
            setThinkingTimeSum(prev => prev + silenceGap);
            lastPauseRef.current = 0;
        }

        const audio = new Audio(cachedUrl);
        audioRef.current = audio;

        audio.onplay = () => setIsPlaying(true);
        audio.onended = () => {
            setIsPlaying(false);
            lastPauseRef.current = Date.now(); // Record start of "thinking" silence
        };
        audio.onerror = () => {
            setIsPlaying(false);
            fallbackSpeak(currentSentence.sentence);
        };

        audio.play().catch(err => {
            console.error("Playback error:", err);
            setIsPlaying(false);
            fallbackSpeak(currentSentence.sentence);
        });
    };

    // Fallback to browser TTS if Gemini fails
    const fallbackSpeak = (text: string) => {
        // If we were in a silence gap, add it to sum
        if (lastPauseRef.current !== 0) {
            const silenceGap = Date.now() - lastPauseRef.current;
            setThinkingTimeSum(prev => prev + silenceGap);
            lastPauseRef.current = 0;
        }

        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1;
        utterance.lang = 'en-US';
        utterance.onstart = () => setIsPlaying(true);
        utterance.onend = () => {
            setIsPlaying(false);
            lastPauseRef.current = Date.now(); // Clock starts after audio ends
        };
        speechSynthesis.speak(utterance);
    };

    const handleReplay = () => {
        setReplays(prev => prev + 1);
        speak();
    };

    const handleSlowPlay = async () => {
        setReplays(prev => prev + 1);
        if (!currentSentence) return;

        // Stop any current audio
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }

        let cachedUrl = audioCache.get(currentSentence.id);

        if (!cachedUrl) {
            setIsPlaying(true);
            cachedUrl = await fetchAudioForIndex(currentIndex, sentences) || undefined;
            if (!cachedUrl) {
                setIsPlaying(false);

                // If we were in a silence gap, add it to sum
                if (lastPauseRef.current !== 0) {
                    const silenceGap = Date.now() - lastPauseRef.current;
                    setThinkingTimeSum(prev => prev + silenceGap);
                    lastPauseRef.current = 0;
                }

                // Fallback to browser TTS
                speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(currentSentence.sentence);
                utterance.rate = 0.7;
                utterance.lang = 'en-US';
                utterance.onstart = () => setIsPlaying(true);
                utterance.onend = () => {
                    setIsPlaying(false);
                    lastPauseRef.current = Date.now();
                };
                speechSynthesis.speak(utterance);
                return;
            }
        }

        // If we were in a "thinking" pause, add that silence gap to the sum
        if (lastPauseRef.current !== 0) {
            const silenceGap = Date.now() - lastPauseRef.current;
            setThinkingTimeSum(prev => prev + silenceGap);
            lastPauseRef.current = 0;
        }

        // Play from cache with SLOW playback rate
        const audio = new Audio(cachedUrl);
        audio.playbackRate = 0.7; // Slow playback!
        audioRef.current = audio;

        audio.onplay = () => setIsPlaying(true);
        audio.onended = () => {
            setIsPlaying(false);
            lastPauseRef.current = Date.now(); // Record start of "thinking" silence
        };
        audio.onerror = () => setIsPlaying(false);

        audio.play();
    };

    // Handle response: simplified to understood (true) or not sure (false)
    const handleResponse = async (understood: boolean) => {
        const responseData: TestResponseData = {
            sentenceId: currentSentence.id,
            sentence: currentSentence.sentence,
            understood,
            replays,
            reactionTimeMs: thinkingTimeSum,
            markedIndices: Array.from(markedIndices),
        };

        const newResponses = [...responses, responseData];
        setResponses(newResponses);

        if (currentIndex < sentences.length - 1) {
            // Next question
            const nextIndex = currentIndex + 1;
            setCurrentIndex(nextIndex);
            setShowTranscript(false);
            setReplays(0);
            setMarkedIndices(new Set());
            setThinkingTimeSum(0);
            lastPauseRef.current = 0;

            // Background pre-fetch for the one after next
            if (nextIndex + 1 < sentences.length) {
                fetchAudioForIndex(nextIndex + 1, sentences);
            }
        } else {
            // Test complete - stop audio and run AI analysis
            if (audioRef.current) {
                audioRef.current.pause();
            }
            setIsPlaying(false);

            setLoading(true);
            setLoadingProgress({ current: 0, total: 0, phase: 'analyzing' });

            // Convert to TestResult format for analysis
            const testResults: TestResult[] = newResponses.map(r => ({
                sentence: r.sentence,
                understood: r.understood,
                replays: r.replays,
                reactionTimeMs: r.reactionTimeMs,
                markedWordIndices: r.markedIndices,
            }));

            const analysisResult = await analyzeListeningResults(testResults);
            setAnalysis(analysisResult);

            // Save results
            localStorage.setItem('minitest_results', JSON.stringify(newResponses));
            localStorage.setItem('minitest_analysis', JSON.stringify(analysisResult));

            setLoading(false);
            setTestComplete(true);
        }
    };

    const toggleWordMark = (index: number) => {
        setMarkedIndices(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };

    // Auto-play on new sentence
    useEffect(() => {
        if (currentSentence && !loading && !testComplete) {
            const timer = setTimeout(() => speak(), 500);
            return () => clearTimeout(timer);
        }
    }, [currentIndex, loading, testComplete]);

    // Loading state with progress
    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <div className="text-center max-w-sm">
                    <Loader2 size={48} className="animate-spin text-purple-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        {loadingProgress.phase === 'sentences'
                            ? 'Generating Sentences...'
                            : loadingProgress.phase === 'audio'
                                ? 'Generating Audio...'
                                : 'Analyzing Your Results...'}
                    </h2>
                    <p className="text-gray-500 mb-4">
                        {loadingProgress.phase === 'sentences'
                            ? 'AI is creating personalized questions'
                            : loadingProgress.phase === 'audio'
                                ? `Preparing audio ${loadingProgress.current} of ${loadingProgress.total}`
                                : 'AI is evaluating your listening ability'}
                    </p>
                    {loadingProgress.phase === 'audio' && loadingProgress.total > 0 && (
                        <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                                style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Results screen with AI Analysis
    if (testComplete) {
        const understoodCount = responses.filter(r => r.understood).length;
        const totalReplays = responses.reduce((sum, r) => sum + r.replays, 0);
        const avgReactionTime = responses.reduce((sum, r) => sum + r.reactionTimeMs, 0) / responses.length;

        return (
            <div className="flex-1 overflow-y-auto bg-gradient-to-br from-gray-50 via-gray-50 to-green-50/30 dark:from-gray-950 dark:via-gray-950 dark:to-green-900/10">
                <div className="max-w-2xl mx-auto p-6 py-12">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                            <Trophy size={40} className="text-white" />
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Test Complete! 🎉
                        </h1>
                        {analysis && (
                            <span className={`inline-block mt-2 px-4 py-1 rounded-full text-sm font-bold ${analysis.overallLevel === 'advanced' ? 'bg-green-100 text-green-700' :
                                analysis.overallLevel === 'intermediate' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                                }`}>
                                {analysis.overallLevel.charAt(0).toUpperCase() + analysis.overallLevel.slice(1)} Level
                            </span>
                        )}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800 text-center">
                            <div className="text-3xl font-bold text-purple-500">{understoodCount}/10</div>
                            <div className="text-xs text-gray-500">Understood</div>
                        </div>
                        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800 text-center">
                            <div className="text-3xl font-bold text-blue-500">{totalReplays}</div>
                            <div className="text-xs text-gray-500">Replays</div>
                        </div>
                        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800 text-center">
                            <div className="text-3xl font-bold text-green-500">{(avgReactionTime / 1000).toFixed(1)}s</div>
                            <div className="text-xs text-gray-500">Avg Thinking Time</div>
                        </div>
                    </div>

                    {/* AI Analysis */}
                    {analysis && (
                        <div className="space-y-4 mb-8">
                            {/* Summary */}
                            <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-100 dark:border-gray-800">
                                <p className="text-gray-700 dark:text-gray-300">{analysis.summary}</p>
                            </div>

                            {/* Strengths & Weaknesses */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-100 dark:border-green-800">
                                    <h3 className="text-sm font-bold text-green-700 dark:text-green-400 mb-2 flex items-center gap-2">
                                        <TrendingUp size={16} /> Strengths
                                    </h3>
                                    <ul className="text-sm text-green-600 dark:text-green-300 space-y-1">
                                        {analysis.strengths.map((s, i) => <li key={i}>• {s}</li>)}
                                    </ul>
                                </div>
                                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-100 dark:border-red-800">
                                    <h3 className="text-sm font-bold text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
                                        <Target size={16} /> Areas to Improve
                                    </h3>
                                    <ul className="text-sm text-red-600 dark:text-red-300 space-y-1">
                                        {analysis.weaknesses.length > 0
                                            ? analysis.weaknesses.map((w, i) => <li key={i}>• {w}</li>)
                                            : <li>• Keep up the good work!</li>}
                                    </ul>
                                </div>
                            </div>

                            {/* Recommendations */}
                            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-100 dark:border-purple-800">
                                <h3 className="text-sm font-bold text-purple-700 dark:text-purple-400 mb-2 flex items-center gap-2">
                                    <Zap size={16} /> Recommendations
                                </h3>
                                <ul className="text-sm text-purple-600 dark:text-purple-300 space-y-1">
                                    {analysis.recommendations.map((r, i) => <li key={i}>• {r}</li>)}
                                </ul>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={onComplete}
                        className="w-full px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-gradient-to-br from-gray-50 via-gray-50 to-purple-50/30 dark:from-gray-950 dark:via-gray-950 dark:to-purple-900/10">
            <div className="min-h-full flex items-center justify-center p-6 py-12">
                <div className="w-full max-w-2xl">
                    {/* Progress with Exit */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={onBack}
                                    className="flex items-center gap-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                    title="Exit to Assessment"
                                >
                                    <ChevronRight size={16} className="rotate-180" />
                                    Exit
                                </button>
                                <span>Question {currentIndex + 1} of {sentences.length}</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${currentSentence?.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                                currentSentence?.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                                }`}>
                                {currentSentence?.difficulty}
                            </span>
                        </div>
                        <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                                style={{ width: `${((currentIndex + 1) / sentences.length) * 100}%` }}
                            />
                        </div>
                    </div>

                    {/* Flashcard */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-8 mb-6">
                        {!showTranscript ? (
                            /* Front: Audio */
                            <div className="text-center py-8">
                                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                                    {isPlaying ? (
                                        <Volume2 size={48} className="text-purple-500 animate-pulse" />
                                    ) : (
                                        <Volume2 size={48} className="text-purple-500" />
                                    )}
                                </div>
                                <p className="text-gray-500 dark:text-gray-400 mb-8">
                                    Listen carefully, then reveal the transcript
                                </p>

                                {/* Audio Controls */}
                                <div className="flex items-center justify-center gap-3 mb-8">
                                    <button
                                        onClick={handleReplay}
                                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        <RotateCcw size={18} />
                                        Replay
                                    </button>
                                    <button
                                        onClick={handleSlowPlay}
                                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        <Play size={18} />
                                        Slow (0.7x)
                                    </button>
                                </div>

                                <button
                                    onClick={() => {
                                        // Add the final thinking gap before revealing
                                        if (lastPauseRef.current !== 0) {
                                            const silenceGap = Date.now() - lastPauseRef.current;
                                            setThinkingTimeSum(prev => prev + silenceGap);
                                            lastPauseRef.current = 0;
                                        }
                                        setShowTranscript(true);
                                    }}
                                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all"
                                >
                                    Show Transcript
                                </button>
                            </div>
                        ) : (
                            /* Back: Transcript + Response */
                            <div>
                                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
                                    Tap words you didn't catch:
                                </h3>
                                <div className="flex flex-wrap gap-2 mb-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl justify-center">
                                    {currentSentence.sentence.split(' ').map((word, i) => {
                                        const isMarked = markedIndices.has(i);
                                        const isPhrasePart = isMarked && (markedIndices.has(i - 1) || markedIndices.has(i + 1));
                                        return (
                                            <button
                                                key={i}
                                                onClick={() => toggleWordMark(i)}
                                                className={`relative px-2 py-1 rounded transition-all ${isMarked
                                                    ? isPhrasePart
                                                        ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 shadow-sm'
                                                        : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                                                    : 'bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                                                    }`}
                                            >
                                                {word}
                                                {isMarked && (
                                                    <span className={`absolute top-0 right-0 w-1.5 h-1.5 rounded-full translate-x-1/2 -translate-y-1/2 border border-white dark:border-gray-900 ${isPhrasePart ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
                                    Did you catch the sentence?
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => handleResponse(true)}
                                        className="flex items-center justify-center gap-3 p-5 rounded-xl border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 hover:border-green-500 hover:scale-[1.02] transition-all"
                                    >
                                        <Check size={24} className="text-green-500" />
                                        <span className="font-bold text-green-700 dark:text-green-400">Got It</span>
                                    </button>
                                    <button
                                        onClick={() => handleResponse(false)}
                                        className="flex items-center justify-center gap-3 p-5 rounded-xl border-2 border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 hover:border-orange-500 hover:scale-[1.02] transition-all"
                                    >
                                        <HelpCircle size={24} className="text-orange-500" />
                                        <span className="font-bold text-orange-700 dark:text-orange-400">Not Sure</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
                        <span>Replays: {replays}</span>
                        {markedIndices.size > 0 && <span>Marked: {markedIndices.size} words</span>}
                    </div>
                </div>
            </div>
        </div>
    );
}
