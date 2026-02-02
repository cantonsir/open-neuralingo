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
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface AssessmentResult {
    targetLanguage: string;
    targetContent: string;
    listeningLevel: number;
    subtitleDependence: number;
    difficulties: string[];
    speakingSpeed: number;
    learningGoal: string;
    skillsFocus: string[];
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

const speakingSpeedDescriptions = [
    'Very slow and clear (like language lessons)',
    'Slow natural speech',
    'Normal conversational pace',
    'Fast natural speech',
    'Native speed with slang/shortcuts'
];

const learningGoals = [
    { id: 'travel', label: 'Travel & Tourism', emoji: '✈️' },
    { id: 'work', label: 'Professional/Work', emoji: '💼' },
    { id: 'entertainment', label: 'Entertainment', emoji: '🎭' },
    { id: 'academic', label: 'Academic Studies', emoji: '📚' },
    { id: 'social', label: 'Social & Friends', emoji: '👥' },
    { id: 'heritage', label: 'Heritage/Family', emoji: '🏠' },
];

const skillsFocusOptions = [
    { id: 'word-recognition', label: 'Catching individual words', icon: '👂' },
    { id: 'meaning-comprehension', label: 'Understanding overall meaning', icon: '💡' },
    { id: 'grammar-patterns', label: 'Grammar & sentence structure', icon: '🔧' },
    { id: 'fast-speech', label: 'Fast or native-speed speech', icon: '⚡' },
    { id: 'real-world', label: 'Real-world conversations', icon: '🌍' },
    { id: 'specific-accents', label: 'Specific accents/dialects', icon: '🗣️' },
];

// Helper function to format relative time
const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
    if (weeks < 4) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
    return `${months} month${months !== 1 ? 's' : ''} ago`;
};

// Helper function to get expected score range based on listening level
const getExpectedScoreRange = (level: number): { min: number; max: number; message: string } => {
    const ranges = [
        { min: 0, max: 2, message: "Just starting - every question is progress!" },
        { min: 2, max: 4, message: "Building foundations - keep practicing!" },
        { min: 3, max: 5, message: "Making steady progress!" },
        { min: 5, max: 7, message: "Solid understanding emerging!" },
        { min: 7, max: 9, message: "Strong comprehension!" },
        { min: 8, max: 10, message: "Near-native listening ability!" }
    ];
    return ranges[level] || ranges[2];
};

// Helper function to generate smart recommendations
const generateRecommendations = (profile: AssessmentResult, latestTest?: any): string[] => {
    const recommendations: string[] = [];
    const contentLabels: Record<string, string> = {
        'anime': 'Anime',
        'movies': 'Movies',
        'daily': 'Daily Life',
        'academic': 'Academic',
        'news': 'News',
        'other': 'General'
    };

    // Based on level vs score
    if (latestTest) {
        const expected = getExpectedScoreRange(profile.listeningLevel);
        const score = latestTest.score || 0;

        if (score < expected.min) {
            if (profile.listeningLevel > 0) {
                recommendations.push(`Try practicing with Level ${profile.listeningLevel - 1} content to build confidence`);
            } else {
                recommendations.push('Start with slow, clear audio and gradually increase difficulty');
            }
        } else if (score > expected.max) {
            if (profile.listeningLevel < 5) {
                recommendations.push(`You're excelling! Consider moving to Level ${profile.listeningLevel + 1} content`);
            }
        }
    }

    // Based on difficulties
    if (profile.difficulties.includes('speed')) {
        recommendations.push('Practice with playback speed at 0.75x to improve comprehension of fast speech');
    }
    if (profile.difficulties.includes('linking')) {
        recommendations.push('Focus on connected speech patterns and weak forms in daily conversations');
    }
    if (profile.difficulties.includes('vocabulary')) {
        recommendations.push('Build vocabulary in your target content area before listening practice');
    }
    if (profile.difficulties.includes('accent')) {
        recommendations.push('Expose yourself to various accents through different speakers and regions');
    }

    // Based on subtitle dependence
    if (profile.subtitleDependence >= 2) {
        recommendations.push('Gradually reduce subtitle use - try hiding them for the first minute');
    } else if (profile.subtitleDependence === 0) {
        recommendations.push('Great subtitle independence! Challenge yourself with faster content');
    }

    // Based on speaking speed vs level
    if (profile.speakingSpeed !== undefined) {
        if (profile.speakingSpeed <= 1 && profile.listeningLevel >= 3) {
            recommendations.push('Try increasing playback speed to 1.25x - you can handle faster speech');
        }
        if (profile.speakingSpeed >= 3 && profile.listeningLevel <= 2) {
            recommendations.push('Start with slower content to build foundation before tackling fast speech');
        }
    }

    // Based on learning goal
    if (profile.learningGoal) {
        const goalRecs: Record<string, string> = {
            travel: `Practice with travel vlogs and airport/hotel dialogues`,
            work: `Focus on professional podcasts and business scenarios`,
            entertainment: `Watch shows/movies with subtitles gradually removed`,
            academic: `Listen to educational lectures at your level`,
            social: `Practice with casual conversation podcasts`,
            heritage: `Connect with native speakers and family content`,
        };
        if (goalRecs[profile.learningGoal]) {
            recommendations.push(goalRecs[profile.learningGoal]);
        }
    }

    // Based on skills focus
    if (profile.skillsFocus && profile.skillsFocus.length > 0) {
        if (profile.skillsFocus.includes('word-recognition')) {
            recommendations.push('Practice dictation: pause after sentences and write what you heard');
        }
        if (profile.skillsFocus.includes('meaning-comprehension')) {
            recommendations.push('Focus on gist listening: summarize main ideas without catching every word');
        }
        if (profile.skillsFocus.includes('grammar-patterns')) {
            recommendations.push('Study common sentence structures before listening practice');
        }
        if (profile.skillsFocus.includes('fast-speech')) {
            recommendations.push('Use variable speed: start 0.75x, gradually increase to 1.25x');
        }
        if (profile.skillsFocus.includes('real-world')) {
            recommendations.push('Practice with unscripted content like podcasts, interviews, and vlogs');
        }
        if (profile.skillsFocus.includes('specific-accents')) {
            recommendations.push('Expose yourself to various speakers from different regions systematically');
        }
    }

    // Content-specific
    const contentType = contentLabels[profile.targetContent] || profile.targetContent;
    recommendations.push(`Practice regularly with ${contentType} content at Level ${profile.listeningLevel} difficulty`);

    // Limit to top 6 recommendations (increased from 4)
    return recommendations.slice(0, 6);
};

// Helper function to analyze weakness breakdown from test analysis
const analyzeWeaknessBreakdown = (analysis: any): { category: string; percentage: number; count: number }[] => {
    if (!analysis || !analysis.weaknesses || !Array.isArray(analysis.weaknesses)) {
        return [];
    }

    const weaknessKeywords: Record<string, string[]> = {
        'Vocabulary': ['vocabulary', 'vocab', 'word', 'words', 'unfamiliar'],
        'Speed': ['speed', 'fast', 'quick', 'pace', 'rapid'],
        'Linking': ['linking', 'connected', 'blending', 'weak form', 'reduction'],
        'Accent': ['accent', 'pronunciation', 'dialect', 'native speaker'],
        'Noise': ['noise', 'background', 'clarity', 'audio quality'],
        'Comprehension': ['understand', 'comprehension', 'meaning', 'context']
    };

    const categoryCounts: Record<string, number> = {};
    let totalCount = 0;

    // Count mentions of each category
    analysis.weaknesses.forEach((weakness: string) => {
        const weaknessLower = weakness.toLowerCase();
        Object.entries(weaknessKeywords).forEach(([category, keywords]) => {
            if (keywords.some(keyword => weaknessLower.includes(keyword))) {
                categoryCounts[category] = (categoryCounts[category] || 0) + 1;
                totalCount++;
            }
        });
    });

    // Convert to array with percentages
    const breakdown = Object.entries(categoryCounts)
        .map(([category, count]) => ({
            category,
            count,
            percentage: totalCount > 0 ? (count / totalCount) * 100 : 0
        }))
        .sort((a, b) => b.percentage - a.percentage);

    return breakdown;
};

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
        speakingSpeed: 2,
        learningGoal: '',
        skillsFocus: [] as string[],
    });

    const totalSteps = 8;

    const canProceed = () => {
        switch (step) {
            case 0: return !!answers.targetLanguage;
            case 1: return !!answers.targetContent;
            case 2: return true; // Level slider
            case 3: return true; // Subtitle slider
            case 4: return answers.difficulties.length > 0;
            case 5: return true; // Speed slider
            case 6: return !!answers.learningGoal; // Goal required
            case 7: return answers.skillsFocus.length > 0; // At least 1 skill
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
    const getLearningGoalLabel = (id: string) => learningGoals.find(g => g.id === id)?.label || id;
    const getSkillsFocusLabel = (id: string) => skillsFocusOptions.find(s => s.id === id)?.label || id;

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

        // Calculate comparison metrics
        const previousTest = savedTestResults && savedTestResults.length > 1
            ? savedTestResults[1]
            : null;

        const scoreDiff = previousTest
            ? understoodCount - previousTest.score
            : 0;

        const avgScoreLast10 = savedTestResults && savedTestResults.length > 0
            ? (savedTestResults.slice(0, 10).reduce((sum, r) => sum + r.score, 0) / Math.min(10, savedTestResults.length)).toFixed(1)
            : 0;

        const personalBest = savedTestResults && savedTestResults.length > 0
            ? Math.max(...savedTestResults.map(r => r.score))
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
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Sparkles size={20} className="text-purple-500" />
                                Part A: Learning Profile
                            </span>
                            {savedAssessment && savedAssessment.completedAt && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                                    Updated {formatRelativeTime(savedAssessment.completedAt)}
                                </span>
                            )}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 col-span-2">
                                <div className="text-xs text-gray-500 mb-2">Listening Level</div>
                                <div className="flex items-center gap-3 mb-1">
                                    <div className="flex-1">
                                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all ${savedAssessment.listeningLevel <= 2
                                                        ? 'bg-red-500'
                                                        : savedAssessment.listeningLevel <= 4
                                                            ? 'bg-yellow-500'
                                                            : 'bg-green-500'
                                                    }`}
                                                style={{ width: `${(savedAssessment.listeningLevel / 5) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="font-bold text-gray-900 dark:text-white text-sm">
                                        {savedAssessment.listeningLevel}/5
                                    </div>
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {levelDescriptions[savedAssessment.listeningLevel]}
                                </div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                                <div className="text-xs text-gray-500 mb-1">Subtitle Use</div>
                                <div className="font-bold text-gray-900 dark:text-white">
                                    {savedAssessment.subtitleDependence}/3
                                </div>
                            </div>
                            {savedAssessment.speakingSpeed !== undefined && (
                                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                                    <div className="text-xs text-gray-500 mb-1">Speaking Speed</div>
                                    <div className="font-bold text-gray-900 dark:text-white">
                                        {savedAssessment.speakingSpeed}/4
                                    </div>
                                </div>
                            )}
                            {savedAssessment.learningGoal && (
                                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                                    <div className="text-xs text-gray-500 mb-1">Learning Goal</div>
                                    <div className="font-bold text-gray-900 dark:text-white">
                                        {getLearningGoalLabel(savedAssessment.learningGoal)}
                                    </div>
                                </div>
                            )}
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
                        {savedAssessment.skillsFocus && savedAssessment.skillsFocus.length > 0 && (
                            <div className="mt-4">
                                <div className="text-xs text-gray-500 mb-2">Focus Skills</div>
                                <div className="flex flex-wrap gap-2">
                                    {savedAssessment.skillsFocus.map(s => (
                                        <span key={s} className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-sm">
                                            {getSkillsFocusLabel(s)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Smart Recommendations */}
                        {(() => {
                            const recommendations = generateRecommendations(savedAssessment, latestResult);
                            if (recommendations.length === 0) return null;

                            return (
                                <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                        <span className="text-lg">💡</span>
                                        Recommendations
                                    </h3>
                                    <ul className="space-y-2">
                                        {recommendations.map((rec, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                                                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                                <span>{rec}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        })()}
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

                                {/* Performance Comparison */}
                                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                    {previousTest && (
                                        <div className="bg-white dark:bg-gray-800/50 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
                                            <div className="text-xs text-gray-500 mb-1">vs Previous Test</div>
                                            <div className={`text-lg font-bold ${scoreDiff > 0 ? 'text-green-600' : scoreDiff < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                                {scoreDiff > 0 ? '↑' : scoreDiff < 0 ? '↓' : '→'} {Math.abs(scoreDiff)} question{Math.abs(scoreDiff) !== 1 ? 's' : ''}
                                                {scoreDiff > 0 && ' 🎉'}
                                            </div>
                                        </div>
                                    )}
                                    <div className="bg-white dark:bg-gray-800/50 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
                                        <div className="text-xs text-gray-500 mb-1">Average (Last 10)</div>
                                        <div className="text-lg font-bold text-amber-600">{avgScoreLast10}/10</div>
                                    </div>
                                    <div className="bg-white dark:bg-gray-800/50 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
                                        <div className="text-xs text-gray-500 mb-1">Personal Best</div>
                                        <div className="text-lg font-bold text-purple-600 flex items-center gap-1">
                                            <Trophy size={18} /> {personalBest}/10
                                        </div>
                                    </div>
                                </div>

                                {/* Expected vs Actual Performance */}
                                {savedAssessment && (
                                    <div className="mt-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                            Performance Check
                                        </h4>
                                        {(() => {
                                            const expected = getExpectedScoreRange(savedAssessment.listeningLevel);
                                            const isOnTrack = understoodCount >= expected.min && understoodCount <= expected.max;
                                            return (
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="text-xs text-gray-600 dark:text-gray-400">
                                                            Expected for Level {savedAssessment.listeningLevel}: {expected.min}-{expected.max}/10
                                                        </div>
                                                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                                            Your Score: {understoodCount}/10 {isOnTrack ? '✓' : '⚠️'}
                                                        </div>
                                                    </div>
                                                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${isOnTrack
                                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                        }`}>
                                                        {isOnTrack ? 'On Track!' : 'Keep Practicing'}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* Weakness Breakdown */}
                                {latestResult && latestResult.analysis && (() => {
                                    const breakdown = analyzeWeaknessBreakdown(latestResult.analysis);
                                    if (breakdown.length === 0) return null;

                                    return (
                                        <div className="mt-4 bg-white dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                                                Weakness Breakdown (Latest Test)
                                            </h4>
                                            <div className="space-y-3">
                                                {breakdown.map((item, i) => (
                                                    <div key={i}>
                                                        <div className="flex items-center justify-between text-xs mb-1">
                                                            <span className="text-gray-600 dark:text-gray-400">{item.category}</span>
                                                            <span className="font-medium text-gray-900 dark:text-white">
                                                                {item.percentage.toFixed(0)}%
                                                                {item.percentage >= 60 && <span className="ml-1 text-orange-500">⚠️</span>}
                                                            </span>
                                                        </div>
                                                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full transition-all ${item.percentage >= 60
                                                                        ? 'bg-red-500'
                                                                        : item.percentage >= 40
                                                                            ? 'bg-orange-500'
                                                                            : 'bg-blue-500'
                                                                    }`}
                                                                style={{ width: `${item.percentage}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Mini Progress Chart */}
                                {savedTestResults && savedTestResults.length > 1 && (() => {
                                    const last10 = savedTestResults.slice(0, 10).reverse();
                                    const chartData = last10.map((test, i) => ({
                                        testNum: i + 1,
                                        score: test.score || 0
                                    }));

                                    return (
                                        <div className="mt-4 bg-white dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                                                Recent Progress (Last {chartData.length} Tests)
                                            </h4>
                                            <ResponsiveContainer width="100%" height={150}>
                                                <LineChart data={chartData}>
                                                    <XAxis
                                                        dataKey="testNum"
                                                        stroke="#9ca3af"
                                                        tick={{ fontSize: 11 }}
                                                        tickLine={false}
                                                    />
                                                    <YAxis
                                                        domain={[0, 10]}
                                                        stroke="#9ca3af"
                                                        tick={{ fontSize: 11 }}
                                                        tickLine={false}
                                                        width={25}
                                                    />
                                                    <Tooltip
                                                        contentStyle={{
                                                            backgroundColor: '#1f2937',
                                                            border: 'none',
                                                            borderRadius: '8px',
                                                            fontSize: '12px'
                                                        }}
                                                        formatter={(value: number) => [`${value}/10`, 'Score']}
                                                        labelFormatter={(label) => `Test ${label}`}
                                                    />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="score"
                                                        stroke="#f59e0b"
                                                        strokeWidth={2}
                                                        dot={{ r: 4, fill: '#f59e0b' }}
                                                        activeDot={{ r: 6 }}
                                                    />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    );
                                })()}

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
                                                <div className="bg-purple-50 dark:bg-purple-900/10 rounded-xl p-4 mb-4 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-purple-200 dark:scrollbar-thumb-purple-900 pr-2">
                                                    <p className="text-sm text-gray-700 dark:text-gray-300 italic whitespace-pre-wrap">
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

                        {/* Step 6: Speaking Speed */}
                        {step === 5 && (
                            <div className="animate-fadeIn">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                        <Gauge size={20} className="text-orange-500" />
                                    </div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                        What speaking speed can you handle comfortably?
                                    </h2>
                                </div>
                                <div className="space-y-6">
                                    <div className="relative">
                                        <input
                                            type="range"
                                            min="0"
                                            max="4"
                                            value={answers.speakingSpeed}
                                            onChange={(e) => setAnswers(prev => ({ ...prev, speakingSpeed: parseInt(e.target.value) }))}
                                            className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-orange-500"
                                        />
                                        <div className="flex justify-between mt-2 text-xs text-gray-400">
                                            {[0, 1, 2, 3, 4].map(n => (
                                                <span key={n} className={answers.speakingSpeed === n ? 'text-orange-500 font-bold' : ''}>{n}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 text-center">
                                        <div className="text-lg font-bold text-orange-700 dark:text-orange-400">
                                            {speakingSpeedDescriptions[answers.speakingSpeed]}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 7: Learning Goal */}
                        {step === 6 && (
                            <div className="animate-fadeIn">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                                        <Target size={20} className="text-teal-500" />
                                    </div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                        What's your main goal for learning this language?
                                    </h2>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {learningGoals.map(goal => (
                                        <button
                                            key={goal.id}
                                            onClick={() => setAnswers(prev => ({ ...prev, learningGoal: goal.id }))}
                                            className={`flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all ${answers.learningGoal === goal.id
                                                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                                                    : 'border-gray-200 dark:border-gray-700 hover:border-teal-300 dark:hover:border-teal-700'
                                                }`}
                                        >
                                            <span className="text-3xl">{goal.emoji}</span>
                                            <span className="font-medium text-gray-900 dark:text-white text-sm text-center">{goal.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Step 8: Skills Focus */}
                        {step === 7 && (
                            <div className="animate-fadeIn">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                        <Target size={20} className="text-indigo-500" />
                                    </div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                        Which listening skills do you want to improve most?
                                    </h2>
                                </div>
                                <p className="text-gray-500 dark:text-gray-400 mb-6 ml-[52px]">
                                    Select 1-2 focus areas
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    {skillsFocusOptions.map(skill => {
                                        const isSelected = answers.skillsFocus.includes(skill.id);
                                        const isDisabled = !isSelected && answers.skillsFocus.length >= 2;

                                        return (
                                            <button
                                                key={skill.id}
                                                onClick={() => {
                                                    setAnswers(prev => {
                                                        const current = prev.skillsFocus;
                                                        if (current.includes(skill.id)) {
                                                            return { ...prev, skillsFocus: current.filter(s => s !== skill.id) };
                                                        } else if (current.length < 2) {
                                                            return { ...prev, skillsFocus: [...current, skill.id] };
                                                        }
                                                        return prev;
                                                    });
                                                }}
                                                disabled={isDisabled}
                                                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${isSelected
                                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                                        : isDisabled
                                                            ? 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
                                                            : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                                                    }`}
                                            >
                                                <span className="text-xl">{skill.icon}</span>
                                                <span className="font-medium text-gray-900 dark:text-white text-sm">{skill.label}</span>
                                                {isSelected && (
                                                    <Check size={18} className="ml-auto text-indigo-500" />
                                                )}
                                            </button>
                                        );
                                    })}
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
