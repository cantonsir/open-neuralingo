import React, { useState, useEffect } from 'react';
import {
    ChevronRight,
    ChevronLeft,
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

interface AssessmentResult {
    targetLanguage: string;
    targetContent: string;
    listeningLevel: number;
    subtitleDependence: number;
    difficulties: string[];
    completedAt: number;
}

interface TestResponse {
    questionId: number;
    sentence: string;
    response: 1 | 2 | 3 | 4;
    replays: number;
    responseTimeMs: number;
    markedWords: string[];
}

interface SelfAssessmentProps {
    onComplete: () => void;
    onStartTest: () => void;
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

export default function SelfAssessment({ onComplete, onStartTest }: SelfAssessmentProps) {
    const [mode, setMode] = useState<'results' | 'assessment'>('results');
    const [savedAssessment, setSavedAssessment] = useState<AssessmentResult | null>(null);
    const [savedTestResults, setSavedTestResults] = useState<TestResponse[] | null>(null);

    // Check for existing results on mount
    useEffect(() => {
        const assessment = localStorage.getItem('assessment_result');
        const testResults = localStorage.getItem('minitest_results');

        if (assessment) {
            setSavedAssessment(JSON.parse(assessment));
        } else {
            setMode('assessment');
        }

        if (testResults) {
            setSavedTestResults(JSON.parse(testResults));
        }
    }, []);

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

    const handleNext = () => {
        if (step < totalSteps - 1) {
            setStep(step + 1);
        } else {
            // Complete assessment
            const result: AssessmentResult = {
                ...answers,
                completedAt: Date.now(),
            };
            localStorage.setItem('assessment_result', JSON.stringify(result));
            setShowComplete(true);
        }
    };

    // Helper to get label from id
    const getLanguageLabel = (id: string) => languages.find(l => l.id === id)?.label || id;
    const getContentLabel = (id: string) => contentTypes.find(c => c.id === id)?.label || id;
    const getDifficultyLabel = (id: string) => difficulties.find(d => d.id === id)?.label || id;

    // Results Dashboard View
    if (mode === 'results' && savedAssessment) {
        const avgScore = savedTestResults
            ? savedTestResults.reduce((sum, r) => sum + r.response, 0) / savedTestResults.length
            : null;
        const totalReplays = savedTestResults
            ? savedTestResults.reduce((sum, r) => sum + r.replays, 0)
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
                        {savedTestResults ? (
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-4 text-center">
                                    <div className="text-3xl font-bold text-purple-600">{avgScore?.toFixed(1)}</div>
                                    <div className="text-xs text-gray-500">Avg Score (1-4)</div>
                                </div>
                                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl p-4 text-center">
                                    <div className="text-3xl font-bold text-blue-600">{totalReplays}</div>
                                    <div className="text-xs text-gray-500">Total Replays</div>
                                </div>
                                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 text-center">
                                    <div className="text-3xl font-bold text-green-600">{savedTestResults.length}</div>
                                    <div className="text-xs text-gray-500">Questions</div>
                                </div>
                            </div>
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
                    </div>

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
