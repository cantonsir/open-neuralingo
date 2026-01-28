import React, { useState, useEffect } from 'react';
import {
    ChevronRight,
    ChevronLeft,
    ChevronDown,
    Check,
    Globe,
    Tv,
    Gauge,
    Subtitles,
    AlertTriangle,
    Sparkles,
    RotateCcw,
    Play,
    Trophy,
    Target,
    Clock
} from 'lucide-react';
import AssessmentStatistics from './AssessmentStatistics';
import AssessmentHistory from './AssessmentHistory';

interface AssessmentResult {
    targetLanguage: string;
    targetContent: string;
    listeningLevel: number;
    subtitleDependence: number;
    difficulties: string[];
    completedAt: number;
}

interface TestResponse {
    sentenceId: number;
    sentence: string;
    understood: boolean;
    replays: number;
    reactionTimeMs: number;
    markedIndices: number[];
}

interface SelfAssessmentProps {
    onComplete: () => void;
    onStartTest: () => void;
    cachedProfile?: AssessmentResult | null;
    cachedResults?: any[] | null;
    isLoaded?: boolean;
    onProfileUpdate?: (profile: AssessmentResult | null) => void;
    onResultsUpdate?: (results: any[] | null) => void;
}

// Question data
const languages = [
    { id: 'en', label: 'English', flag: '🇬🇧' },
    { id: 'ja', label: 'Japanese', flag: '🇯🇵' },
    { id: 'zh-HK', label: 'Cantonese', flag: '🇭🇰' },
    { id: 'zh-CN', label: 'Mandarin', flag: '🇨🇳' },
    { id: 'de', label: 'German', flag: '🇩🇪' },
];

const contentTypes = [
    { id: 'anime', label: 'Anime', emoji: '🎌' },
    { id: 'movies', label: 'Movies', emoji: '🎬' },
    { id: 'daily', label: 'Daily Life', emoji: '💬' },
    { id: 'academic', label: 'Academic', emoji: '🎓' },
    { id: 'news', label: 'News', emoji: '📰' },
    { id: 'other', label: 'Other', emoji: '📺' },
];

const levelDescriptions = [
    'Cannot recognize words at all',
    'Can catch a few high-frequency words',
    'Can understand slow, short sentences',
    'Can understand daily speech but miss words',
    'Can watch shows with occasional pauses',
    'Can watch without pausing',
];

const subtitleDescriptions = [
    'Never use subtitles',
    'Occasionally need subtitles',
    'Often need subtitles',
    'Must use subtitles',
];

const difficulties = [
    { id: 'vocabulary', label: 'Insufficient Vocabulary', icon: '📚' },
    { id: 'speed', label: 'Speech Too Fast', icon: '⚡' },
    { id: 'linking', label: 'Linking & Weak Forms', icon: '🔗' },
    { id: 'accent', label: 'Accent Variations', icon: '🗣️' },
    { id: 'noise', label: 'Background Noise', icon: '🔊' },
    { id: 'multi', label: 'Multi-speaker', icon: '👥' },
];

export default function SelfAssessment({ 
    onComplete, 
    onStartTest,
    cachedProfile,
    cachedResults,
    isLoaded = false,
    onProfileUpdate,
    onResultsUpdate
}: SelfAssessmentProps) {
    const [mode, setMode] = useState<'results' | 'assessment'>('results');
    const [savedAssessment, setSavedAssessment] = useState<AssessmentResult | null>(cachedProfile || null);
    const [savedTestResults, setSavedTestResults] = useState<any[] | null>(cachedResults || null);

    // Use cached data from props - no fetch needed!
    useEffect(() => {
        if (isLoaded) {
            setSavedAssessment(cachedProfile || null);
            setSavedTestResults(cachedResults || null);
            if (!cachedProfile) {
                setMode('assessment');
            }
        }
    }, [cachedProfile, cachedResults, isLoaded]);

    const [step, setStep] = useState(0);
    const [answers, setAnswers] = useState({
        targetLanguage: '',
        targetContent: '',
        listeningLevel: 2,
        subtitleDependence: 1,
        difficulties: [] as string[],
    });

    const totalSteps = 5;

    const canProceed = () => {
        switch (step) {
            case 0: return !!answers.targetLanguage;
            case 1: return !!answers.targetContent;
            case 2: return true; // Slider always has value
            case 3: return true; // Slider always has value
            case 4: return answers.difficulties.length > 0;
            default: return false;
        }
    };

    const [showComplete, setShowComplete] = useState(false);
    const [isReviewExpanded, setIsReviewExpanded] = useState(false);
    const [isAIFeedbackExpanded, setIsAIFeedbackExpanded] = useState(true);
    const [isDetailedReviewExpanded, setIsDetailedReviewExpanded] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    const handleNext = async () => {
        if (step < totalSteps - 1) {
            setStep(step + 1);
        } else {
            // Complete assessment
            const result: AssessmentResult = {
                ...answers,
                completedAt: Date.now(),
            };

            try {
                await fetch('/api/assessment/profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(result)
                });

                setSavedAssessment(result); // Optimistic update
                onProfileUpdate?.(result); // Update parent cache
                setShowComplete(true);
            } catch (error) {
                console.error("Failed to save profile:", error);
                // Optionally show error toast
            }
        }
    };

    // Helper to get label from id
    const getLanguageLabel = (id: string) => languages.find(l => l.id === id)?.label || id;
    const getContentLabel = (id: string) => contentTypes.find(c => c.id === id)?.label || id;
    const getDifficultyLabel = (id: string) => difficulties.find(d => d.id === id)?.label || id;

    // Show loading state while data is being fetched at app level
    if (!isLoaded) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-50 to-purple-50/30 dark:from-gray-950 dark:via-gray-950 dark:to-purple-900/10">
                <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-4 border-4 border-purple-200 border-t-purple-500 rounded-full animate-spin"></div>
                    <p className="text-gray-500 dark:text-gray-400">Loading your profile...</p>
                </div>
            </div>
        );
    }

    // Results Dashboard View
    if (mode === 'results' && savedAssessment) {
        // Get the latest result if multiple exist
        const latestResult = savedTestResults && savedTestResults.length > 0
            ? savedTestResults[0] // API returns ordered by taken_at DESC
            : null;

        const understoodCount = latestResult?.score || 0;

        // Calculate total replays from responses if available, or just use what we have (API ensures structure)
        // Since API returns { score, totalQuestions, responses: [...] }, we need to check structure
        // Let's assume we want to show the latest result stats
        const latestResponses = latestResult?.responses || [];
        const totalReplays = latestResponses.reduce((sum: number, r: any) => sum + (r.replays || 0), 0);

        const avgThinkingTime = latestResponses.length > 0
            ? latestResponses.reduce((sum: number, r: any) => sum + (r.reactionTimeMs || 0), 0) / latestResponses.length
            : 0;

        return (
            <div className="flex-1 overflow-y-auto bg-gradient-to-br from-gray-50 via-gray-50 to-purple-50/30 dark:from-gray-950 dark:via-gray-950 dark:to-purple-900/10">
                <div className="max-w-4xl mx-auto p-6 py-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-sm font-medium mb-4">
                            <Target size={16} />
                            Listening Assessment
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Your Profile
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400">
                            Based on your self-assessment
                        </p>
                    </div>

                    {/* Part A: Self-Assessment Results */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 mb-6">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <Sparkles size={20} className="text-purple-500" />
                            Part A: Learning Profile
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                                <div className="text-xs text-gray-500 mb-1">Language</div>
                                <div className="font-bold text-gray-900 dark:text-white">
                                    {getLanguageLabel(savedAssessment.targetLanguage)}
                                </div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                                <div className="text-xs text-gray-500 mb-1">Content</div>
                                <div className="font-bold text-gray-900 dark:text-white">
                                    {getContentLabel(savedAssessment.targetContent)}
                                </div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                                <div className="text-xs text-gray-500 mb-1">Level</div>
                                <div className="font-bold text-gray-900 dark:text-white">
                                    {savedAssessment.listeningLevel}/5
                                </div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                                <div className="text-xs text-gray-500 mb-1">Subtitle Use</div>
                                <div className="font-bold text-gray-900 dark:text-white">
                                    {savedAssessment.subtitleDependence}/3
                                </div>
                            </div>
                        </div>
                        {savedAssessment.difficulties.length > 0 && (
                            <div className="mt-4">
                                <div className="text-xs text-gray-500 mb-2">Main Difficulties</div>
                                <div className="flex flex-wrap gap-2">
                                    {savedAssessment.difficulties.map(d => (
                                        <span key={d} className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full text-sm">
                                            {getDifficultyLabel(d)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Part B: Mini-Test Results */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 mb-6">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <Trophy size={20} className="text-green-500" />
                            Part B: Mini-Test Results
                        </h2>
                        {latestResult ? (
                            <>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-4 text-center">
                                        <div className="text-3xl font-bold text-purple-600">{understoodCount}/10</div>
                                        <div className="text-xs text-gray-500">Understood</div>
                                    </div>
                                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl p-4 text-center">
                                        <div className="text-3xl font-bold text-blue-600">{totalReplays}</div>
                                        <div className="text-xs text-gray-500">Total Replays</div>
                                    </div>
                                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 text-center">
                                        <div className="text-3xl font-bold text-green-600">{(avgThinkingTime / 1000).toFixed(1)}s</div>
                                        <div className="text-xs text-gray-500">Avg Thinking Time</div>
                                    </div>
                                    <div className="bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 rounded-xl p-4 text-center">
                                        <div className="text-3xl font-bold text-orange-600">{latestResult.totalQuestions || 10}</div>
                                        <div className="text-xs text-gray-500">Questions</div>
                                    </div>
                                </div>

                                {/* AI Analysis Section */}
                                {latestResult.analysis && (
                                    <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
                                        <button
                                            onClick={() => setIsAIFeedbackExpanded(!isAIFeedbackExpanded)}
                                            className="w-full flex items-center justify-between text-md font-bold text-gray-900 dark:text-white mb-4 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                                        >
                                            <span className="flex items-center gap-2">
                                                <Sparkles size={18} className="text-purple-500" />
                                                AI Feedback
                                            </span>
                                            <ChevronDown 
                                                size={20} 
                                                className={`text-gray-400 transition-transform duration-200 ${isAIFeedbackExpanded ? 'rotate-180' : ''}`} 
                                            />
                                        </button>

                                        {isAIFeedbackExpanded && (
                                            <>
                                                <div className="bg-purple-50 dark:bg-purple-900/10 rounded-xl p-4 mb-4">
                                                    <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                                                        "{latestResult.analysis.summary}"
                                                    </p>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="bg-green-50 dark:bg-green-900/10 rounded-xl p-4">
                                                        <div className="text-xs font-bold text-green-700 dark:text-green-400 mb-2 uppercase tracking-wide">Strengths</div>
                                                        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                                            {latestResult.analysis.strengths?.map((s: string, i: number) => (
                                                                <li key={i} className="flex items-start gap-2">
                                                                    <span className="mt-1.5 w-1 h-1 rounded-full bg-green-500" />
                                                                    {s}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                    <div className="bg-orange-50 dark:bg-orange-900/10 rounded-xl p-4">
                                                        <div className="text-xs font-bold text-orange-700 dark:text-orange-400 mb-2 uppercase tracking-wide">Focus Areas</div>
                                                        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                                            {latestResult.analysis.weaknesses?.map((w: string, i: number) => (
                                                                <li key={i} className="flex items-start gap-2">
                                                                    <span className="mt-1.5 w-1 h-1 rounded-full bg-orange-500" />
                                                                    {w}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Detailed Sentence Review */}
                                {Array.isArray(latestResult.responses) && latestResult.responses.length > 0 && (
                                    <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
                                        <button
                                            onClick={() => setIsDetailedReviewExpanded(!isDetailedReviewExpanded)}
                                            className="w-full flex items-center justify-between text-md font-bold text-gray-900 dark:text-white mb-4 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                                        >
                                            <span className="flex items-center gap-2">
                                                Detailed Review
                                                <span className="text-xs font-normal text-gray-400">({latestResult.responses.length} questions)</span>
                                            </span>
                                            <ChevronDown 
                                                size={20} 
                                                className={`text-gray-400 transition-transform duration-200 ${isDetailedReviewExpanded ? 'rotate-180' : ''}`} 
                                            />
                                        </button>
                                        
                                        {isDetailedReviewExpanded && (
                                            <div className="space-y-3">
                                                {latestResult.responses.map((resp: any, i: number) => (
                                                    <div key={i} className={`p-4 rounded-xl border ${resp.understood
                                                        ? 'bg-white dark:bg-gray-800/50 border-gray-100 dark:border-gray-800'
                                                        : 'bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30'
                                                        }`}>
                                                        <div className="flex items-start justify-between gap-4 mb-2">
                                                            <span className="text-xs font-medium text-gray-400">Question {i + 1}</span>
                                                            {resp.understood ? (
                                                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Understood</span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Missed</span>
                                                            )}
                                                        </div>

                                                        <p className="text-gray-800 dark:text-gray-200 text-lg mb-3">
                                                            {resp.sentence.split(' ').map((word: string, wIdx: number) => {
                                                                const isMarked = resp.markedIndices?.includes(wIdx) || resp.markedWordIndices?.includes(wIdx);
                                                                return (
                                                                    <span key={wIdx} className={isMarked ? "text-red-500 font-bold underline decoration-red-300 underline-offset-4" : ""}>
                                                                        {word}{" "}
                                                                    </span>
                                                                );
                                                            })}
                                                        </p>

                                                        <div className="flex items-center flex-wrap gap-4 text-xs text-gray-400">
                                                            <span className="flex items-center gap-1">
                                                                <RotateCcw size={12} /> {resp.replays} Replays
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <Clock size={12} /> {(resp.reactionTimeMs / 1000).toFixed(1)}s Thinking
                                                            </span>
                                                        </div>

                                                        {/* Show slider feedback if available */}
                                                        {!resp.understood && resp.wordBoundaries !== undefined && (
                                                            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                                                                <div className="text-xs font-medium text-gray-500 mb-2">Self-Assessment:</div>
                                                                <div className="flex flex-wrap gap-2 text-xs">
                                                                    <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded">
                                                                        Boundaries: {resp.wordBoundaries}/5
                                                                    </span>
                                                                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                                                                        Familiarity: {resp.familiarity}/5
                                                                    </span>
                                                                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded">
                                                                        Meaning: {resp.meaningClarity}/5
                                                                    </span>
                                                                    {resp.wordConfusion !== undefined && (
                                                                        <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded">
                                                                            Confusion: {resp.wordConfusion}/5
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-6">
                                <p className="text-gray-500 dark:text-gray-400 mb-4">
                                    You haven't taken the mini-test yet
                                </p>
                                <button
                                    onClick={onStartTest}
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all"
                                >
                                    <Play size={18} />
                                    Take Mini-Test
                                </button>
                            </div>
                        )}

                        {/* View Full History Button */}
                        {savedTestResults && savedTestResults.length > 0 && (
                            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 text-center">
                                <button
                                    onClick={() => setShowHistory(true)}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <Clock size={16} />
                                    View Full History ({savedTestResults.length} results)
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Learning Progress & Statistics */}
                    {savedTestResults && savedTestResults.length > 0 && (
                        <div className="mb-6">
                            <AssessmentStatistics />
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={() => {
                                setMode('assessment');
                                setStep(0);
                            }}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            <RotateCcw size={18} />
                            Retake Assessment
                        </button>
                        {savedTestResults && (
                            <button
                                onClick={onStartTest}
                                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all"
                            >
                                <Play size={18} />
                                Retake Mini-Test
                            </button>
                        )}
                    </div>

                    {/* Assessment History Modal */}
                    {showHistory && (
                        <AssessmentHistory onClose={() => setShowHistory(false)} />
                    )}
                </div>
            </div>
        );
    }

    // Completion screen
    if (showComplete) {
        return (
            <div className="flex-1 overflow-y-auto bg-gradient-to-br from-gray-50 via-gray-50 to-green-50/30 dark:from-gray-950 dark:via-gray-950 dark:to-green-900/10">
                <div className="min-h-full flex items-center justify-center p-6 py-12">
                    <div className="w-full max-w-md text-center">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                            <Check size={40} className="text-white" />
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Assessment Complete! 🎉
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mb-8">
                            Ready to test your listening skills with AI-generated sentences?
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={onStartTest}
                                className="w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg"
                            >
                                Start Mini-Test (10 questions)
                            </button>
                            <button
                                onClick={onComplete}
                                className="w-full px-6 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                            >
                                Skip for now
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const handleBack = () => {
        if (step > 0) setStep(step - 1);
    };

    const toggleDifficulty = (id: string) => {
        setAnswers(prev => {
            const current = prev.difficulties;
            if (current.includes(id)) {
                return { ...prev, difficulties: current.filter(d => d !== id) };
            } else if (current.length < 2) {
                return { ...prev, difficulties: [...current, id] };
            }
            return prev;
        });
    };

    return (
        <div className="flex-1 overflow-y-auto bg-gradient-to-br from-gray-50 via-gray-50 to-purple-50/30 dark:from-gray-950 dark:via-gray-950 dark:to-purple-900/10">
            <div className="min-h-full flex items-center justify-center p-6 py-12">
                <div className="w-full max-w-2xl">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-sm font-medium mb-4">
                            <Sparkles size={16} />
                            Self-Assessment
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Let's personalize your learning
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400">
                            Answer 5 quick questions to calibrate your experience
                        </p>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                            <span>Step {step + 1} of {totalSteps}</span>
                            <span>{Math.round(((step + 1) / totalSteps) * 100)}%</span>
                        </div>
                        <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500 ease-out"
                                style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
                            />
                        </div>
                    </div>

                    {/* Question Card */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-8 mb-6">
                        {/* Step 1: Target Language */}
                        {step === 0 && (
                            <div className="animate-fadeIn">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                        <Globe size={20} className="text-purple-500" />
                                    </div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                        What language are you learning?
                                    </h2>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {languages.map(lang => (
                                        <button
                                            key={lang.id}
                                            onClick={() => setAnswers(prev => ({ ...prev, targetLanguage: lang.id }))}
                                            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${answers.targetLanguage === lang.id
                                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700'
                                                }`}
                                        >
                                            <span className="text-2xl">{lang.flag}</span>
                                            <span className="font-medium text-gray-900 dark:text-white">{lang.label}</span>
                                            {answers.targetLanguage === lang.id && (
                                                <Check size={18} className="ml-auto text-purple-500" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Step 2: Target Content */}
                        {step === 1 && (
                            <div className="animate-fadeIn">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                        <Tv size={20} className="text-blue-500" />
                                    </div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                        What content do you want to understand?
                                    </h2>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {contentTypes.map(content => (
                                        <button
                                            key={content.id}
                                            onClick={() => setAnswers(prev => ({ ...prev, targetContent: content.id }))}
                                            className={`flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all ${answers.targetContent === content.id
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                                                }`}
                                        >
                                            <span className="text-3xl">{content.emoji}</span>
                                            <span className="font-medium text-gray-900 dark:text-white">{content.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Step 3: Listening Level */}
                        {step === 2 && (
                            <div className="animate-fadeIn">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                        <Gauge size={20} className="text-green-500" />
                                    </div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                        How would you rate your listening level?
                                    </h2>
                                </div>
                                <div className="space-y-6">
                                    <div className="relative">
                                        <input
                                            type="range"
                                            min="0"
                                            max="5"
                                            value={answers.listeningLevel}
                                            onChange={(e) => setAnswers(prev => ({ ...prev, listeningLevel: parseInt(e.target.value) }))}
                                            className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-green-500"
                                        />
                                        <div className="flex justify-between mt-2 text-xs text-gray-400">
                                            {[0, 1, 2, 3, 4, 5].map(n => (
                                                <span key={n} className={answers.listeningLevel === n ? 'text-green-500 font-bold' : ''}>{n}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
                                        <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">
                                            Level {answers.listeningLevel}
                                        </div>
                                        <div className="text-gray-600 dark:text-gray-400">
                                            {levelDescriptions[answers.listeningLevel]}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 4: Subtitle Dependence */}
                        {step === 3 && (
                            <div className="animate-fadeIn">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                                        <Subtitles size={20} className="text-yellow-600" />
                                    </div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                        How often do you rely on subtitles?
                                    </h2>
                                </div>
                                <div className="space-y-6">
                                    <div className="relative">
                                        <input
                                            type="range"
                                            min="0"
                                            max="3"
                                            value={answers.subtitleDependence}
                                            onChange={(e) => setAnswers(prev => ({ ...prev, subtitleDependence: parseInt(e.target.value) }))}
                                            className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-yellow-500"
                                        />
                                        <div className="flex justify-between mt-2 text-xs text-gray-400">
                                            {[0, 1, 2, 3].map(n => (
                                                <span key={n} className={answers.subtitleDependence === n ? 'text-yellow-600 font-bold' : ''}>{n}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 text-center">
                                        <div className="text-lg font-bold text-yellow-700 dark:text-yellow-400">
                                            {subtitleDescriptions[answers.subtitleDependence]}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 5: Difficulties */}
                        {step === 4 && (
                            <div className="animate-fadeIn">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                        <AlertTriangle size={20} className="text-red-500" />
                                    </div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                        What are your biggest difficulties?
                                    </h2>
                                </div>
                                <p className="text-gray-500 dark:text-gray-400 mb-6 ml-[52px]">
                                    Select up to 2 options
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    {difficulties.map(diff => (
                                        <button
                                            key={diff.id}
                                            onClick={() => toggleDifficulty(diff.id)}
                                            disabled={!answers.difficulties.includes(diff.id) && answers.difficulties.length >= 2}
                                            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${answers.difficulties.includes(diff.id)
                                                ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                                : answers.difficulties.length >= 2
                                                    ? 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
                                                    : 'border-gray-200 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-700'
                                                }`}
                                        >
                                            <span className="text-xl">{diff.icon}</span>
                                            <span className="font-medium text-gray-900 dark:text-white text-sm">{diff.label}</span>
                                            {answers.difficulties.includes(diff.id) && (
                                                <Check size={18} className="ml-auto text-red-500" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center justify-between">
                        <button
                            onClick={handleBack}
                            disabled={step === 0}
                            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all ${step === 0
                                ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                        >
                            <ChevronLeft size={20} />
                            Back
                        </button>
                        <button
                            onClick={handleNext}
                            disabled={!canProceed()}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${canProceed()
                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/25'
                                : 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            {step === totalSteps - 1 ? 'Complete' : 'Next'}
                            {step === totalSteps - 1 ? <Check size={20} /> : <ChevronRight size={20} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
