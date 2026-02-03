import React, { useState, useEffect } from 'react';
import { TrendingUp, Calendar, BookOpen, BarChart3, Award, Target, Clock, Filter } from 'lucide-react';

interface AssessmentSummary {
    id: string;
    profileId: string;
    takenAt: number;
    overallLevel: number;
    vocabularyLevel: number;
    grammarLevel: number;
    primaryBarrier: string;
    totalWordsRead: number;
    totalWordsMarked: number;
    totalSentencesRead: number;
    totalSentencesMarked: number;
    vocabularyCoverage: number;
    sentenceComprehension: number;
}

interface ReadingStatisticsProps {
    onViewAssessment?: (assessmentId: string) => void;
    onTakeNewAssessment?: () => void;
    variant?: 'page' | 'embedded';  // 'page' shows full header/container, 'embedded' is for use inside results page
}

const ReadingStatistics: React.FC<ReadingStatisticsProps> = ({ onViewAssessment, onTakeNewAssessment, variant = 'page' }) => {
    const isEmbedded = variant === 'embedded';
    const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<'all' | '30d' | '90d' | '1y'>('all');

    useEffect(() => {
        loadAssessments();
    }, []);

    const loadAssessments = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/reading/assessments');
            const data = await response.json();
            setAssessments(data);
        } catch (error) {
            console.error('Error loading assessments:', error);
        }
        setLoading(false);
    };

    // Filter assessments by date range
    const filteredAssessments = assessments.filter(a => {
        if (dateRange === 'all') return true;

        const now = Date.now();
        const assessmentDate = a.takenAt;

        switch (dateRange) {
            case '30d':
                return now - assessmentDate <= 30 * 24 * 60 * 60 * 1000;
            case '90d':
                return now - assessmentDate <= 90 * 24 * 60 * 60 * 1000;
            case '1y':
                return now - assessmentDate <= 365 * 24 * 60 * 60 * 1000;
            default:
                return true;
        }
    });

    // Calculate statistics
    const stats = {
        totalAssessments: filteredAssessments.length,
        currentLevel: filteredAssessments.length > 0 ? filteredAssessments[0].overallLevel : 0,
        avgVocabularyCoverage: filteredAssessments.length > 0
            ? filteredAssessments.reduce((sum, a) => sum + a.vocabularyCoverage, 0) / filteredAssessments.length
            : 0,
        avgSentenceComprehension: filteredAssessments.length > 0
            ? filteredAssessments.reduce((sum, a) => sum + a.sentenceComprehension, 0) / filteredAssessments.length
            : 0,
        totalWordsRead: filteredAssessments.reduce((sum, a) => sum + a.totalWordsRead, 0),
        totalWordsMarked: filteredAssessments.reduce((sum, a) => sum + a.totalWordsMarked, 0),
        improvement: calculateImprovement(filteredAssessments),
    };

    function calculateImprovement(assessments: AssessmentSummary[]) {
        if (assessments.length < 2) return 0;

        const sorted = [...assessments].sort((a, b) => a.takenAt - b.takenAt);
        const first = sorted[0];
        const last = sorted[sorted.length - 1];

        const firstScore = (first.vocabularyCoverage + first.sentenceComprehension) / 2;
        const lastScore = (last.vocabularyCoverage + last.sentenceComprehension) / 2;

        return lastScore - firstScore;
    }

    // Get trend data for charts
    const getTrendData = () => {
        const sorted = [...filteredAssessments].sort((a, b) => a.takenAt - b.takenAt);

        return sorted.map((a, index) => ({
            index: index + 1,
            date: new Date(a.takenAt).toLocaleDateString(),
            vocabularyLevel: a.vocabularyLevel,
            grammarLevel: a.grammarLevel,
            overallLevel: a.overallLevel,
            vocabularyCoverage: a.vocabularyCoverage,
            sentenceComprehension: a.sentenceComprehension,
        }));
    };

    const trendData = getTrendData();

    if (loading) {
        return (
            <div className={isEmbedded ? "py-8 text-center" : "flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900"}>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Loading statistics...</p>
                </div>
            </div>
        );
    }

    if (assessments.length === 0) {
        return (
            <div className={isEmbedded ? "py-8 text-center" : "flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900"}>
                <div className="text-center max-w-md">
                    <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        No Assessment Data Yet
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Take your first reading assessment to start tracking your progress.
                    </p>
                    {!isEmbedded && onTakeNewAssessment && (
                        <button
                            onClick={onTakeNewAssessment}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Take Assessment
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Simplified embedded content - just summary cards
    const embeddedContent = (
        <div className="space-y-4">
            {/* Summary Cards - Compact 2x2 Grid */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {stats.totalAssessments}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Total Tests</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                        Level {stats.currentLevel}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Current Level</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">
                        {stats.avgVocabularyCoverage.toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Avg Vocab</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-center">
                    <div className={`text-2xl font-bold ${stats.improvement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {stats.improvement >= 0 ? '+' : ''}{stats.improvement.toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Trend</div>
                </div>
            </div>

            {/* Brief summary text */}
            <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                {stats.totalAssessments > 1 ? (
                    <p>You've completed {stats.totalAssessments} assessments. Keep practicing to improve!</p>
                ) : stats.totalAssessments === 1 ? (
                    <p>Great start! Take more assessments to track your progress over time.</p>
                ) : (
                    <p>Complete assessments to see your progress statistics here.</p>
                )}
            </div>
        </div>
    );

    // Full page content with all details
    const fullStatisticsContent = (
        <div className={isEmbedded ? "space-y-6" : "max-w-6xl mx-auto space-y-6"}>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Assessments */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-gray-600 dark:text-gray-400">Total Assessments</div>
                        <Calendar className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                        {stats.totalAssessments}
                    </div>
                </div>

                {/* Current Level */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-gray-600 dark:text-gray-400">Current Level</div>
                        <Award className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                        Level {stats.currentLevel}
                    </div>
                </div>

                {/* Vocabulary Coverage */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-gray-600 dark:text-gray-400">Avg Vocabulary</div>
                        <BookOpen className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                        {stats.avgVocabularyCoverage.toFixed(1)}%
                    </div>
                </div>

                {/* Improvement */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-gray-600 dark:text-gray-400">Improvement</div>
                        <TrendingUp className={`w-5 h-5 ${stats.improvement >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                    </div>
                    <div className={`text-3xl font-bold ${stats.improvement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {stats.improvement >= 0 ? '+' : ''}{stats.improvement.toFixed(1)}%
                    </div>
                </div>
            </div>

            {/* Progress Charts */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Level Progress Over Time
                </h3>

                {trendData.length > 0 ? (
                    <div className="space-y-4">
                        {/* Simple text-based chart */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                        <th className="pb-2">Date</th>
                                        <th className="pb-2">Overall</th>
                                        <th className="pb-2">Vocabulary</th>
                                        <th className="pb-2">Grammar</th>
                                        <th className="pb-2">Vocab Coverage</th>
                                        <th className="pb-2">Comprehension</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {trendData.map((data, idx) => (
                                        <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                                            <td className="py-3 text-gray-700 dark:text-gray-300">{data.date}</td>
                                            <td className="py-3">
                                                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded text-xs font-medium">
                                                    Level {data.overallLevel}
                                                </span>
                                            </td>
                                            <td className="py-3">
                                                <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded text-xs font-medium">
                                                    Level {data.vocabularyLevel}
                                                </span>
                                            </td>
                                            <td className="py-3">
                                                <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 rounded text-xs font-medium">
                                                    Level {data.grammarLevel}
                                                </span>
                                            </td>
                                            <td className="py-3 text-gray-700 dark:text-gray-300">
                                                {data.vocabularyCoverage.toFixed(1)}%
                                            </td>
                                            <td className="py-3 text-gray-700 dark:text-gray-300">
                                                {data.sentenceComprehension.toFixed(1)}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                        No trend data available
                    </p>
                )}
            </div>

            {/* Cumulative Stats */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Cumulative Statistics
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                            {stats.totalWordsRead.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Total Words Read</div>
                    </div>

                    <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                            {stats.totalWordsMarked.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Total Words Marked</div>
                    </div>

                    <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                            {stats.avgSentenceComprehension.toFixed(1)}%
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Avg Sentence Comprehension</div>
                    </div>
                </div>
            </div>

            {/* Recent Assessments */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Recent Assessments
                    </h3>
                    {!isEmbedded && onTakeNewAssessment && (
                        <button
                            onClick={onTakeNewAssessment}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                            Take New Assessment
                        </button>
                    )}
                </div>

                <div className="space-y-3">
                    {filteredAssessments.slice(0, 5).map((assessment) => (
                        <div
                            key={assessment.id}
                            className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                            onClick={() => onViewAssessment?.(assessment.id)}
                        >
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                        {new Date(assessment.takenAt).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </div>
                                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded text-xs font-medium">
                                        Level {assessment.overallLevel}
                                    </span>
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                        assessment.primaryBarrier === 'vocabulary'
                                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                                            : assessment.primaryBarrier === 'grammar'
                                            ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200'
                                            : 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200'
                                    }`}>
                                        {assessment.primaryBarrier}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                                    <span>Vocab: {assessment.vocabularyCoverage.toFixed(1)}%</span>
                                    <span>Comprehension: {assessment.sentenceComprehension.toFixed(1)}%</span>
                                    <span>{assessment.totalWordsRead} words read</span>
                                </div>
                            </div>
                            <div className="text-gray-400">
                                <Clock className="w-5 h-5" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    // Embedded mode: return simplified content directly without page wrapper
    if (isEmbedded) {
        return embeddedContent;
    }

    // Page mode: return full page layout
    return (
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <BarChart3 className="w-6 h-6 text-blue-600" />
                        Reading Progress & Statistics
                    </h2>

                    {/* Date Range Filter */}
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gray-500" />
                        <select
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value as any)}
                            className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
                        >
                            <option value="all">All Time</option>
                            <option value="30d">Last 30 Days</option>
                            <option value="90d">Last 90 Days</option>
                            <option value="1y">Last Year</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 overflow-y-auto p-6">
                {fullStatisticsContent}
            </div>
        </div>
    );
};

export default ReadingStatistics;
