import React, { useState, useEffect } from 'react';
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
import { generateTestSentences, TestSentence, analyzeListeningResults, TestResult, ListeningAnalysis } from '../../services/geminiService';
import ListeningFeedbackSliders from './ListeningFeedbackSliders';
import { useListeningTest, TestResponseData } from '../../hooks/useListeningTest';

interface AssessmentResult {
    targetLanguage: string;
    targetContent: string;
    listeningLevel: number;
    subtitleDependence: number;
    difficulties: string[];
    speakingSpeed: number;
    learningGoal: string;
    skillsFocus: string[];
}

interface MiniTestProps {
    onComplete: () => void;
    onBack: () => void;
}

const MiniTest: React.FC<MiniTestProps> = ({ onComplete, onBack }) => {
    const [loading, setLoading] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0, phase: 'sentences' as 'sentences' | 'audio' | 'analyzing' });
    const [sentences, setSentences] = useState<TestSentence[]>([]);
    const [testComplete, setTestComplete] = useState(false);
    const [analysis, setAnalysis] = useState<ListeningAnalysis | null>(null);
    const [finalResponses, setFinalResponses] = useState<TestResponseData[]>([]);

    // Handle test completion
    const handleTestComplete = async (responses: TestResponseData[]) => {
        setFinalResponses(responses);
        setLoading(true);
        setLoadingProgress({ current: 0, total: 0, phase: 'analyzing' });

        // Convert to TestResult format for analysis
        const testResults: TestResult[] = responses.map(r => ({
            sentence: r.sentence,
            understood: r.understood,
            replays: r.replays,
            reactionTimeMs: r.reactionTimeMs,
            markedWordIndices: r.markedIndices,
            wordBoundaries: r.wordBoundaries,
            familiarity: r.familiarity,
            meaningClarity: r.meaningClarity,
            wordConfusion: r.wordConfusion,
        }));

        const analysisResult = await analyzeListeningResults(testResults);
        setAnalysis(analysisResult);

        // Save results to API
        try {
            await fetch('/api/assessment/results', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    responses,
                    analysis: analysisResult
                })
            });
        } catch (error) {
            console.error("Failed to save results:", error);
        }

        setLoading(false);
        setTestComplete(true);
    };

    // Use shared listening test hook
    const test = useListeningTest({
        sentences,
        onComplete: handleTestComplete,
        autoPlay: !loading && !testComplete,
    });

    const {
        currentIndex,
        currentSentence,
        showTranscript,
        replays,
        markedIndices,
        showSliders,
        sliderValues,
        isPlaying,
        audioProgress,
        handleReplay,
        handleSlowPlay,
        toggleWordMark,
        revealTranscript,
        handleNotSure,
        handleResponse,
        handleSliderSubmit,
        setSliderValues,
        stopAll,
        preloadAudio,
        clearCache,
        isExiting,
    } = test;

    // Load assessment and generate sentences
    useEffect(() => {
        let cancelled = false; // Guard against StrictMode double-run

        const loadTest = async () => {
            // Clear any previous audio cache
            clearCache();
            isExiting.current = false;

            // 1. Get assessment from API
            let assessment: AssessmentResult = { targetLanguage: 'en', targetContent: 'movies', listeningLevel: 2, subtitleDependence: 1, difficulties: [], speakingSpeed: 2, learningGoal: 'entertainment', skillsFocus: [] };
            try {
                const res = await fetch('/api/assessment/profile');
                if (cancelled) return;
                if (res.ok) {
                    const profile = await res.json();
                    if (profile) assessment = profile;
                }
            } catch (e) {
                console.error("Failed to fetch profile, using defaults", e);
            }

            if (cancelled) return;

            // 2. Generate sentences
            setLoadingProgress({ current: 0, total: 0, phase: 'sentences' });
            const generatedSentences = await generateTestSentences(assessment);
            if (cancelled) return;
            setSentences(generatedSentences);

            // 3. Preload first audio
            setLoadingProgress({ current: 0, total: 1, phase: 'audio' });
            if (generatedSentences.length > 0) {
                await preloadAudio(generatedSentences[0]);
                if (cancelled) return;

                // Pre-fetch the second one in background
                if (generatedSentences.length > 1) {
                    preloadAudio(generatedSentences[1]);
                }
            }

            setLoading(false);
        };

        loadTest();

        return () => {
            cancelled = true;
        };
    }, [clearCache, preloadAudio, isExiting]);

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
        const understoodCount = finalResponses.filter(r => r.understood).length;
        const totalReplays = finalResponses.reduce((sum, r) => sum + r.replays, 0);
        const avgReactionTime = finalResponses.reduce((sum, r) => sum + r.reactionTimeMs, 0) / finalResponses.length;

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
                        onClick={() => {
                            stopAll();
                            onComplete();
                        }}
                        className="w-full px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg"
                    >
                        Back to Assessment
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
                                    onClick={() => {
                                        stopAll();
                                        onBack();
                                    }}
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
                                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                                    {isPlaying ? (
                                        <Volume2 size={48} className="text-purple-500 animate-pulse" />
                                    ) : (
                                        <Volume2 size={48} className="text-purple-500" />
                                    )}
                                </div>

                                {/* Audio Progress Bar */}
                                <div className="w-48 mx-auto mb-6">
                                    <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full bg-gradient-to-r from-purple-500 to-pink-500 ${isPlaying ? '' : 'opacity-60'}`}
                                            style={{ width: `${audioProgress * 100}%` }}
                                        />
                                    </div>
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
                                    onClick={revealTranscript}
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

                                {/* Slider Panel for "Not Sure" */}
                                {showSliders ? (
                                    <ListeningFeedbackSliders
                                        values={sliderValues}
                                        onChange={setSliderValues}
                                        onSubmit={handleSliderSubmit}
                                    />
                                ) : (
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => handleResponse(true)}
                                            className="flex items-center justify-center gap-3 p-5 rounded-xl border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 hover:border-green-500 hover:scale-[1.02] transition-all"
                                        >
                                            <Check size={24} className="text-green-500" />
                                            <span className="font-bold text-green-700 dark:text-green-400">Got It</span>
                                        </button>
                                        <button
                                            onClick={handleNotSure}
                                            className="flex items-center justify-center gap-3 p-5 rounded-xl border-2 border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 hover:border-orange-500 hover:scale-[1.02] transition-all"
                                        >
                                            <HelpCircle size={24} className="text-orange-500" />
                                            <span className="font-bold text-orange-700 dark:text-orange-400">Not Sure</span>
                                        </button>
                                    </div>
                                )}
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

export default MiniTest;
