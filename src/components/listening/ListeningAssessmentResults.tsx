/**
 * Listening Assessment Results Component
 * 
 * Displays comprehensive assessment results with three collapsible sections:
 * - Part A: Learning Profile (summary of user's listening preferences)
 * - Part B: Mini-Test Results (detailed analysis from the test)
 * - Learning Progress & Statistics
 * 
 * Design matches the Reading module's ReadingAssessmentResults component.
 */

import React, { useState } from 'react';
import {
    ChevronDown,
    ChevronUp,
    Globe,
    Gauge,
    Target,
    AlertTriangle,
    Sparkles,
    RotateCcw,
    Play,
    Trophy,
    Clock,
    BarChart3
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import AssessmentStatistics from './AssessmentStatistics';
import AssessmentHistory from './AssessmentHistory';

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

interface ListeningAssessmentResultsProps {
    profile: AssessmentResult;
    testResults: any[] | null;
    onRetakeAssessment: () => void;
    onStartTest: () => void;
}

// Data labels
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

const difficulties = [
    { id: 'vocabulary', label: 'Insufficient Vocabulary', icon: '📚' },
    { id: 'speed', label: 'Speech Too Fast', icon: '⚡' },
    { id: 'linking', label: 'Linking & Weak Forms', icon: '🔗' },
    { id: 'accent', label: 'Accent Variations', icon: '🗣️' },
    { id: 'noise', label: 'Background Noise', icon: '🔊' },
    { id: 'multi', label: 'Multi-speaker', icon: '👥' },
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

// Helper functions
const getLanguageLabel = (id: string) => languages.find(l => l.id === id)?.label || id;
const getContentLabel = (id: string) => contentTypes.find(c => c.id === id)?.label || id;
const getDifficultyLabel = (id: string) => difficulties.find(d => d.id === id)?.label || id;
const getLearningGoalLabel = (id: string) => learningGoals.find(g => g.id === id)?.label || id;
const getSkillsFocusLabel = (id: string) => skillsFocusOptions.find(s => s.id === id)?.label || id;

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

    if (profile.difficulties.includes('speed')) {
        recommendations.push('Practice with playback speed at 0.75x to improve comprehension of fast speech');
    }
    if (profile.difficulties.includes('linking')) {
        recommendations.push('Focus on connected speech patterns and weak forms in daily conversations');
    }
    if (profile.difficulties.includes('vocabulary')) {
        recommendations.push('Build vocabulary in your target content area before listening practice');
    }

    const contentType = contentLabels[profile.targetContent] || profile.targetContent;
    recommendations.push(`Practice regularly with ${contentType} content at Level ${profile.listeningLevel} difficulty`);

    return recommendations.slice(0, 5);
};

const ListeningAssessmentResults: React.FC<ListeningAssessmentResultsProps> = ({
    profile,
    testResults,
    onRetakeAssessment,
    onStartTest,
}) => {
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['partA', 'partB']));
    const [showHistory, setShowHistory] = useState(false);
    const [isAIFeedbackExpanded, setIsAIFeedbackExpanded] = useState(true);
    const [isDetailedReviewExpanded, setIsDetailedReviewExpanded] = useState(false);

    const toggleSection = (section: string) => {
        const newExpanded = new Set(expandedSections);
        if (newExpanded.has(section)) {
            newExpanded.delete(section);
        } else {
            newExpanded.add(section);
        }
        setExpandedSections(newExpanded);
    };

    const isExpanded = (section: string) => expandedSections.has(section);

    // Get the latest result
    const latestResult = testResults && testResults.length > 0 ? testResults[0] : null;
    const understoodCount = latestResult?.score || 0;
    const latestResponses = latestResult?.responses || [];
    const totalReplays = latestResponses.reduce((sum: number, r: any) => sum + (r.replays || 0), 0);
    const avgThinkingTime = latestResponses.length > 0
        ? latestResponses.reduce((sum: number, r: any) => sum + (r.reactionTimeMs || 0), 0) / latestResponses.length
        : 0;

    // Comparison metrics
    const previousTest = testResults && testResults.length > 1 ? testResults[1] : null;
    const scoreDiff = previousTest ? understoodCount - previousTest.score : 0;
    const avgScoreLast10 = testResults && testResults.length > 0
        ? (testResults.slice(0, 10).reduce((sum, r) => sum + r.score, 0) / Math.min(10, testResults.length)).toFixed(1)
        : 0;
    const personalBest = testResults && testResults.length > 0
        ? Math.max(...testResults.map(r => r.score))
        : 0;

    return (
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Target className="w-6 h-6 text-purple-600" />
                        Listening Assessment Results
                    </h2>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onRetakeAssessment}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Retake
                        </button>
                        <button
                            onClick={onStartTest}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                        >
                            <Play className="w-4 h-4" />
                            Take Test
                        </button>
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* Part A: Learning Profile */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <button
                            onClick={() => toggleSection('partA')}
                            className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-gray-200 dark:border-gray-700"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                                    A
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    Learning Profile
                                </h3>
                            </div>
                            {isExpanded('partA') ? (
                                <ChevronUp className="w-5 h-5 text-gray-500" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-gray-500" />
                            )}
                        </button>

                        {isExpanded('partA') && (
                            <div className="p-6 space-y-4">
                                {/* Language & Level Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Globe className="w-5 h-5 text-blue-600" />
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                                Target Language
                                            </span>
                                        </div>
                                        <p className="text-lg font-semibold text-gray-900 dark:text-white">
                                            {getLanguageLabel(profile.targetLanguage)}
                                        </p>
                                    </div>

                                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Gauge className="w-5 h-5 text-green-600" />
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                                Listening Level
                                            </span>
                                        </div>
                                        <p className="text-lg font-semibold text-gray-900 dark:text-white">
                                            Level {profile.listeningLevel}
                                        </p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {levelDescriptions[profile.listeningLevel]}
                                        </p>
                                    </div>
                                </div>

                                {/* Content Preference */}
                                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Sparkles className="w-5 h-5 text-purple-600" />
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                            Target Content
                                        </span>
                                    </div>
                                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                                        {getContentLabel(profile.targetContent)}
                                    </p>
                                </div>

                                {/* Difficulties */}
                                {profile.difficulties.length > 0 && (
                                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <AlertTriangle className="w-5 h-5 text-orange-600" />
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                                Main Difficulties
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {profile.difficulties.map(diff => (
                                                <span
                                                    key={diff}
                                                    className="px-3 py-1.5 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 rounded-full text-sm font-medium"
                                                >
                                                    {getDifficultyLabel(diff)}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Goals */}
                                {profile.learningGoal && (
                                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Target className="w-5 h-5 text-green-600" />
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                                Learning Goal
                                            </span>
                                        </div>
                                        <span className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full text-sm font-medium">
                                            {getLearningGoalLabel(profile.learningGoal)}
                                        </span>
                                    </div>
                                )}

                                {/* Skills Focus */}
                                {profile.skillsFocus && profile.skillsFocus.length > 0 && (
                                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Target className="w-5 h-5 text-indigo-600" />
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                                Focus Skills
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {profile.skillsFocus.map(skill => (
                                                <span
                                                    key={skill}
                                                    className="px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200 rounded-full text-sm font-medium"
                                                >
                                                    {getSkillsFocusLabel(skill)}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Recommendations */}
                                {(() => {
                                    const recommendations = generateRecommendations(profile, latestResult);
                                    if (recommendations.length === 0) return null;

                                    return (
                                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                                💡 Recommendations
                                            </h4>
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
                        )}
                    </div>

                    {/* Part B: Mini-Test Results */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <button
                            onClick={() => toggleSection('partB')}
                            className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-b border-gray-200 dark:border-gray-700"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm">
                                    B
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    Mini-Test Results
                                </h3>
                            </div>
                            {isExpanded('partB') ? (
                                <ChevronUp className="w-5 h-5 text-gray-500" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-gray-500" />
                            )}
                        </button>

                        {isExpanded('partB') && (
                            <div className="p-6">
                                {latestResult ? (
                                    <>
                                        {/* Score Cards */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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

                                        {/* Comparison Stats */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                                            {previousTest && (
                                                <div className="bg-white dark:bg-gray-800/50 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
                                                    <div className="text-xs text-gray-500 mb-1">vs Previous Test</div>
                                                    <div className={`text-lg font-bold ${scoreDiff > 0 ? 'text-green-600' : scoreDiff < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                                        {scoreDiff > 0 ? '↑' : scoreDiff < 0 ? '↓' : '→'} {Math.abs(scoreDiff)} question{Math.abs(scoreDiff) !== 1 ? 's' : ''}
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

                                        {/* Mini Progress Chart */}
                                        {testResults && testResults.length > 1 && (
                                            <div className="bg-white dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700 mb-6">
                                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                                                    Recent Progress (Last {Math.min(10, testResults.length)} Tests)
                                                </h4>
                                                <ResponsiveContainer width="100%" height={150}>
                                                    <LineChart data={testResults.slice(0, 10).reverse().map((test, i) => ({
                                                        testNum: i + 1,
                                                        score: test.score || 0
                                                    }))}>
                                                        <XAxis dataKey="testNum" stroke="#9ca3af" tick={{ fontSize: 11 }} tickLine={false} />
                                                        <YAxis domain={[0, 10]} stroke="#9ca3af" tick={{ fontSize: 11 }} tickLine={false} width={25} />
                                                        <Tooltip
                                                            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', fontSize: '12px' }}
                                                            formatter={(value: number) => [`${value}/10`, 'Score']}
                                                            labelFormatter={(label) => `Test ${label}`}
                                                        />
                                                        <Line type="monotone" dataKey="score" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4, fill: '#f59e0b' }} activeDot={{ r: 6 }} />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        )}

                                        {/* AI Analysis */}
                                        {latestResult.analysis && (
                                            <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
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

                                        {/* Detailed Review */}
                                        {Array.isArray(latestResult.responses) && latestResult.responses.length > 0 && (
                                            <div className="border-t border-gray-100 dark:border-gray-800 pt-4 mt-4">
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
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* View History Button */}
                                        {testResults && testResults.length > 0 && (
                                            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 text-center">
                                                <button
                                                    onClick={() => setShowHistory(true)}
                                                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                                >
                                                    <Clock size={16} />
                                                    View Full History ({testResults.length} results)
                                                </button>
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
                            </div>
                        )}
                    </div>

                    {/* Learning Progress & Statistics */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <button
                            onClick={() => toggleSection('statistics')}
                            className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 border-b border-gray-200 dark:border-gray-700"
                        >
                            <div className="flex items-center gap-3">
                                <BarChart3 className="w-6 h-6 text-green-600" />
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    Learning Progress & Statistics
                                </h3>
                            </div>
                            {isExpanded('statistics') ? (
                                <ChevronUp className="w-5 h-5 text-gray-500" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-gray-500" />
                            )}
                        </button>

                        {isExpanded('statistics') && (
                            <div className="p-6">
                                {testResults && testResults.length > 0 ? (
                                    <AssessmentStatistics />
                                ) : (
                                    <div className="text-center py-8">
                                        <p className="text-gray-500 dark:text-gray-400">
                                            Take your first mini-test to see your learning progress!
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <button
                            onClick={onRetakeAssessment}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            <RotateCcw className="w-5 h-5" />
                            Retake Assessment
                        </button>
                        <button
                            onClick={onStartTest}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all"
                        >
                            <Play className="w-5 h-5" />
                            {testResults ? 'Retake Mini-Test' : 'Take Mini-Test'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Assessment History Modal */}
            {showHistory && (
                <AssessmentHistory onClose={() => setShowHistory(false)} />
            )}
        </div>
    );
};

export default ListeningAssessmentResults;
