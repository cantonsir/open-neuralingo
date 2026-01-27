import React from 'react';
import { PlayCircle, TrendingUp, Clock, Flame, Play, BookOpen } from 'lucide-react';

export interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    subtext: string;
    color: string;
}

export function StatCard({ icon, label, value, subtext, color }: StatCardProps) {
    // Map color names to tailwind classes roughly
    const bgColors: Record<string, string> = {
        purple: 'bg-purple-500/10',
        blue: 'bg-blue-500/10',
        green: 'bg-green-500/10',
        orange: 'bg-orange-500/10',
        red: 'bg-red-500/10',
        pink: 'bg-pink-500/10',
        teal: 'bg-teal-500/10',
    };

    const textColors: Record<string, string> = {
        purple: 'text-purple-500',
        blue: 'text-blue-500',
        green: 'text-green-500',
        orange: 'text-orange-500',
        red: 'text-red-500',
        pink: 'text-pink-500',
        teal: 'text-teal-500',
    };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl ${bgColors[color] || 'bg-gray-100'} flex items-center justify-center`}>
                    <div className={textColors[color] || 'text-gray-500'}>{icon}</div>
                </div>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {value}
            </div>
            <div className="text-xs text-gray-400 mt-1">{subtext}</div>
        </div>
    );
}

export interface CommonDashboardProps {
    title: string;
    subtitle: string;
    stats: StatCardProps[];
    weeklyData?: { label: string; value: number }[];
    recentItems?: React.ReactNode;
    quickActions?: React.ReactNode;
    onStartAction?: () => void;
    startActionLabel?: string;
    colorTheme?: 'orange' | 'blue' | 'green' | 'purple';
}

export default function CommonDashboard({
    title,
    subtitle,
    stats,
    weeklyData = [], // Default empty
    recentItems,
    quickActions,
    onStartAction,
    startActionLabel = "Start Practice",
    colorTheme = 'orange'
}: CommonDashboardProps) {

    // Calculate max value for scaling
    const maxValue = Math.max(...weeklyData.map(d => d.value), 1); // Avoid div by zero

    // Theme configuration
    const gradients = {
        orange: 'from-yellow-500 to-orange-500',
        blue: 'from-blue-400 to-indigo-500',
        green: 'from-green-400 to-emerald-500',
        purple: 'from-purple-400 to-pink-500',
    };

    const textColors = {
        orange: 'text-yellow-600 dark:text-yellow-400',
        blue: 'text-blue-600 dark:text-blue-400',
        green: 'text-green-600 dark:text-green-400',
        purple: 'text-purple-600 dark:text-purple-400',
    };

    const buttonTextColors = {
        orange: 'text-yellow-600',
        blue: 'text-blue-600',
        green: 'text-green-600',
        purple: 'text-purple-600',
    };

    const headerGradient = gradients[colorTheme];

    return (
        <div className="flex-1 overflow-y-auto">
            {/* ... (Welcome Header remains same, omitted here for brevity if replace_file_content supports range, but I'm rewriting the whole component start usually or finding context) */}
            {/* Actually, I will just provide the full component body related to this change or use broad enough context */}
            {/* Since I need to replace props destructuring AND the render block, it's safer to replace a large chunk or multiple chunks. */}
            {/* Wait, the tool is replace_file_content (single block). I will replace from props definition down to the closing of Weekly Activity div. */}

            {/* Welcome Header */}
            <div className={`bg-gradient-to-r ${headerGradient} px-8 py-8`}>
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">
                            {title}
                        </h1>
                        <p className="text-white/80 text-lg">
                            {subtitle}
                        </p>
                    </div>
                    {onStartAction && (
                        <button
                            onClick={onStartAction}
                            className={`flex items-center gap-2 px-6 py-3 bg-white ${buttonTextColors[colorTheme]} font-bold rounded-xl hover:bg-opacity-90 transition-colors shadow-lg`}
                        >
                            <PlayCircle size={22} />
                            {startActionLabel}
                        </button>
                    )}
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-8 py-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {stats.map((stat, index) => (
                        <StatCard
                            key={index}
                            icon={stat.icon}
                            label={stat.label}
                            value={stat.value}
                            subtext={stat.subtext}
                            color={stat.color}
                        />
                    ))}
                </div>

                {/* Weekly Activity */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm mb-8">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <TrendingUp size={20} className={textColors[colorTheme]} />
                        Weekly Activity
                    </h3>
                    {weeklyData.length > 0 ? (
                        <div className="flex items-end justify-between gap-2 h-32">
                            {weeklyData.map((data, i) => {
                                const heightPercentage = (data.value / maxValue) * 100;
                                const isHighlighted = data.value > 0;

                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                                        <div
                                            className={`w-full rounded-t-lg transition-all duration-500 ease-out ${isHighlighted
                                                ? `bg-gradient-to-t ${gradients[colorTheme]}`
                                                : 'bg-gray-100 dark:bg-gray-800'
                                                }`}
                                            style={{ height: isHighlighted ? `${Math.max(heightPercentage, 10)}%` : '4px' }}
                                        />
                                        <span className={`text-xs font-medium ${isHighlighted
                                            ? textColors[colorTheme]
                                            : 'text-gray-400'
                                            }`}>
                                            {data.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500">No activity data available</div>
                    )}
                </div>

                {/* Main Grid: Recent & Actions */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        {recentItems}
                    </div>
                    <div>
                        {quickActions}
                    </div>
                </div>
            </div>
        </div>
    );
}
