/**
 * Speaking Assessment Statistics Component
 *
 * Displays learning curve visualization and statistical analysis
 * of speaking assessment test results.
 */

import React, { useState, useEffect } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    TooltipProps,
    BarChart,
    Bar,
    Legend
} from 'recharts';
import { useSpeakingAssessmentStats, ScoreTrendData, TimeWindow } from '../../hooks/useSpeakingAssessmentStats';

interface CustomTooltipProps extends TooltipProps<number, string> {
    active?: boolean;
    payload?: Array<{
        value: number;
        dataKey: string;
        payload: ScoreTrendData;
    }>;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const date = new Date(data.date);
        const formattedDate = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });

        return (
            <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                <p className="font-semibold text-gray-900 dark:text-white mb-1">
                    Test {data.testNumber}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{formattedDate}</p>
                <p className="text-sm">
                    <span className="text-gray-700 dark:text-gray-300">Translation: </span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                        {data.translationAccuracy.toFixed(1)}%
                    </span>
                </p>
                <p className="text-sm">
                    <span className="text-gray-700 dark:text-gray-300">Conversation: </span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {data.conversationCoherence.toFixed(1)}%
                    </span>
                </p>
                <p className="text-sm">
                    <span className="text-gray-700 dark:text-gray-300">Level: </span>
                    <span className="font-medium">{data.overallLevel}</span>
                </p>
            </div>
        );
    }
    return null;
};

const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload) return null;

    const score = payload.translationAccuracy;
    let fillColor = '#ef4444';
    if (score >= 80) {
        fillColor = '#22c55e';
    } else if (score >= 60) {
        fillColor = '#eab308';
    }

    return (
        <circle cx={cx} cy={cy} r={5} fill={fillColor} stroke="#fff" strokeWidth={2} />
    );
};

interface SpeakingAssessmentStatisticsProps {
    variant?: 'page' | 'embedded';
}

const SpeakingAssessmentStatistics: React.FC<SpeakingAssessmentStatisticsProps> = ({
    variant = 'embedded'
}) => {
    const [timeWindow, setTimeWindow] = useState<TimeWindow>('last_10');
    const { stats, loading, refetch } = useSpeakingAssessmentStats(timeWindow);
    const [hasRetried, setHasRetried] = useState(false);

    useEffect(() => {
        if (!loading && (!stats || stats.summary.totalTests === 0) && !hasRetried) {
            setHasRetried(true);
            refetch();
        }
    }, [stats, loading, hasRetried, refetch]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500"></div>
            </div>
        );
    }

    if (!stats || stats.summary.totalTests === 0) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                    No assessment data available yet. Take your first speaking test to see your learning curve!
                </p>
            </div>
        );
    }

    const weaknessChartData: any[] = [];
    if (stats.weaknessEvolution && Object.keys(stats.weaknessEvolution).length > 0) {
        const weaknessTypes = Object.keys(stats.weaknessEvolution);
        const dataLength = stats.weaknessEvolution[weaknessTypes[0]]?.length || 0;

        for (let i = 0; i < dataLength; i++) {
            const dataPoint: any = { test: `Test ${i + 1}` };
            weaknessTypes.forEach(type => {
                dataPoint[type] = stats.weaknessEvolution[type][i] || 0;
            });
            weaknessChartData.push(dataPoint);
        }
    }

    const hasWeaknessData = weaknessChartData.length > 0 &&
        Object.keys(stats.weaknessEvolution || {}).length > 0;

    return (
        <div className="space-y-6">
            {/* Time Range Selector */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Learning Progress & Statistics
                </h3>
                <div className="flex items-center gap-2">
                    {(['last_10', 'last_30', 'all_time'] as TimeWindow[]).map(tw => (
                        <button
                            key={tw}
                            onClick={() => setTimeWindow(tw)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                timeWindow === tw
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            {tw === 'last_10' ? 'Last 10 Tests' : tw === 'last_30' ? 'Last 30 Days' : 'All Time'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Tests</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.summary.totalTests}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg Accuracy</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {stats.summary.avgTranslationAccuracy.toFixed(1)}%
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Trend</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {stats.summary.improvementRate}
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Current Level</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        Level {stats.summary.currentLevel}
                    </p>
                </div>
            </div>

            {/* Score Trend Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Learning Curve</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={stats.scoreTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                        <XAxis
                            dataKey="testNumber"
                            label={{ value: 'Test Number', position: 'insideBottom', offset: -5 }}
                            stroke="#9ca3af"
                        />
                        <YAxis
                            domain={[0, 100]}
                            label={{ value: 'Score (%)', angle: -90, position: 'insideLeft' }}
                            stroke="#9ca3af"
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Line
                            type="monotone"
                            dataKey="translationAccuracy"
                            stroke="#22c55e"
                            strokeWidth={3}
                            dot={<CustomDot />}
                            activeDot={{ r: 7 }}
                            name="Translation"
                        />
                        <Line
                            type="monotone"
                            dataKey="conversationCoherence"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6 }}
                            name="Conversation"
                        />
                    </LineChart>
                </ResponsiveContainer>

                <div className="mt-4 flex items-center justify-center space-x-6 text-sm">
                    <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                        <span className="text-gray-600 dark:text-gray-400">&lt; 60%</span>
                    </div>
                    <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                        <span className="text-gray-600 dark:text-gray-400">60-79%</span>
                    </div>
                    <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                        <span className="text-gray-600 dark:text-gray-400">80%+</span>
                    </div>
                </div>
            </div>

            {/* Weakness Evolution Chart */}
            {hasWeaknessData && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Weakness Tracking</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={weaknessChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                            <XAxis dataKey="test" stroke="#9ca3af" tick={{ fontSize: 12 }} />
                            <YAxis
                                stroke="#9ca3af"
                                label={{ value: 'Issues', angle: -90, position: 'insideLeft' }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#1f2937',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: '#f9fafb'
                                }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                            {Object.keys(stats.weaknessEvolution || {}).map((weakness, index) => {
                                const colors = ['#ef4444', '#f59e0b', '#8b5cf6', '#3b82f6'];
                                return (
                                    <Bar
                                        key={weakness}
                                        dataKey={weakness}
                                        stackId="a"
                                        fill={colors[index % colors.length]}
                                        name={weakness.charAt(0).toUpperCase() + weakness.slice(1)}
                                    />
                                );
                            })}
                        </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                        Lower bars indicate improvement - issues appearing less frequently
                    </div>
                </div>
            )}
        </div>
    );
};

export default SpeakingAssessmentStatistics;
