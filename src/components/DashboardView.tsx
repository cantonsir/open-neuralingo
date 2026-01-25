import React, { useState, useEffect } from 'react';
import {
    Play,
    PlayCircle,
    BookOpen,
    Clock,
    Flame,
    TrendingUp,
    ArrowRight,
    Layers,
    Trash2,
    X,
    Check
} from 'lucide-react';
import { api, HistoryItem } from '../db';

interface DashboardViewProps {
    onPlayVideo: (videoId: string) => void;
    onNavigate: (view: string) => void;
    savedCardsCount: number;
    markersCount: number;
}

// Mock stats data (to be replaced with real data later)
const mockStats = {
    videosWatched: 12,
    wordsLearned: 156,
    practiceHours: 4.5,
    dayStreak: 7
};

// Mock weekly streak (true = practiced that day)
const weeklyStreak = [true, true, true, true, true, false, false];
const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
}

export default function DashboardView({
    onPlayVideo,
    onNavigate,
    savedCardsCount,
    markersCount
}: DashboardViewProps) {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadHistory = async () => {
            setLoading(false);
            const data = await api.fetchHistory();
            setHistory(data);
            setLoading(false);
        };
        loadHistory();
    }, []);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    };

    return (
        <div className="flex-1 overflow-y-auto">
            {/* Welcome Header */}
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 px-8 py-8">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">
                            {getGreeting()}! 👋
                        </h1>
                        <p className="text-white/80 text-lg">
                            Ready to sharpen your listening skills today?
                        </p>
                    </div>
                    <button
                        onClick={() => onNavigate('loop')}
                        className="flex items-center gap-2 px-6 py-3 bg-white text-yellow-600 font-bold rounded-xl hover:bg-yellow-50 transition-colors shadow-lg"
                    >
                        <PlayCircle size={22} />
                        Start Practice
                    </button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-8 py-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {/* Videos Watched */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                <Play size={20} className="text-purple-500" fill="currentColor" />
                            </div>
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Videos</span>
                        </div>
                        <div className="text-3xl font-bold text-gray-900 dark:text-white">
                            {history.length || mockStats.videosWatched}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">Total practiced</div>
                    </div>

                    {/* Words Learned */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                <BookOpen size={20} className="text-blue-500" />
                            </div>
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Words</span>
                        </div>
                        <div className="text-3xl font-bold text-gray-900 dark:text-white">
                            {savedCardsCount || mockStats.wordsLearned}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">Saved to deck</div>
                    </div>

                    {/* Practice Time */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                                <Clock size={20} className="text-green-500" />
                            </div>
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Time</span>
                        </div>
                        <div className="text-3xl font-bold text-gray-900 dark:text-white">
                            {mockStats.practiceHours}h
                        </div>
                        <div className="text-xs text-gray-400 mt-1">This week</div>
                    </div>

                    {/* Day Streak */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                                <Flame size={20} className="text-orange-500" />
                            </div>
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Streak</span>
                        </div>
                        <div className="text-3xl font-bold text-gray-900 dark:text-white">
                            {mockStats.dayStreak}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">Day streak 🔥</div>
                    </div>
                </div>

                {/* Weekly Activity */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm mb-8">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <TrendingUp size={20} className="text-yellow-500" />
                        Weekly Activity
                    </h3>
                    <div className="flex items-end justify-between gap-2">
                        {weekDays.map((day, i) => (
                            <div key={day} className="flex-1 flex flex-col items-center gap-2">
                                <div
                                    className={`w-full rounded-lg transition-all ${weeklyStreak[i]
                                            ? 'bg-gradient-to-t from-yellow-500 to-orange-400'
                                            : 'bg-gray-100 dark:bg-gray-800'
                                        }`}
                                    style={{ height: weeklyStreak[i] ? `${40 + Math.random() * 40}px` : '20px' }}
                                />
                                <span className={`text-xs font-medium ${weeklyStreak[i]
                                        ? 'text-yellow-600 dark:text-yellow-400'
                                        : 'text-gray-400'
                                    }`}>
                                    {day}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Two Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Recent Videos */}
                    <div className="lg:col-span-2">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Clock size={18} className="text-gray-400" />
                                Recent Videos
                            </h3>
                            {history.length > 4 && (
                                <button className="text-sm text-yellow-600 hover:text-yellow-700 font-medium flex items-center gap-1">
                                    View all <ArrowRight size={14} />
                                </button>
                            )}
                        </div>

                        {loading ? (
                            <div className="text-gray-500 py-8 text-center">Loading...</div>
                        ) : history.length > 0 ? (
                            <div className="grid grid-cols-2 gap-4">
                                {history.slice(0, 4).map((item) => (
                                    <div
                                        key={item.videoId}
                                        onClick={() => onPlayVideo(item.videoId)}
                                        className="group cursor-pointer bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800 hover:border-yellow-500/50 hover:shadow-lg transition-all"
                                    >
                                        <div className="relative aspect-video bg-gray-200 dark:bg-gray-800">
                                            <img
                                                src={item.thumbnail}
                                                alt={item.title}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect fill="%23374151" width="320" height="180"/><text fill="%239CA3AF" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="14">No Thumbnail</text></svg>';
                                                }}
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                                <div className="w-12 h-12 rounded-full bg-yellow-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                                                    <Play size={20} fill="white" className="text-white ml-1" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-3">
                                            <h4 className="font-medium text-gray-900 dark:text-white text-sm line-clamp-2 group-hover:text-yellow-600 transition-colors">
                                                {item.title}
                                            </h4>
                                            <p className="text-xs text-gray-500 mt-1">{formatTimeAgo(item.watchedAt)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-8 text-center">
                                <div className="text-4xl mb-3">📺</div>
                                <p className="text-gray-500 dark:text-gray-400">No videos yet. Start practicing!</p>
                            </div>
                        )}
                    </div>

                    {/* Quick Actions */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <Layers size={18} className="text-gray-400" />
                            Quick Actions
                        </h3>
                        <div className="space-y-3">
                            <button
                                onClick={() => onNavigate('loop')}
                                className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-200 dark:border-yellow-800/30 rounded-xl hover:from-yellow-500/20 hover:to-orange-500/20 transition-all group"
                            >
                                <div className="w-10 h-10 rounded-lg bg-yellow-500 flex items-center justify-center">
                                    <PlayCircle size={20} className="text-white" />
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="font-semibold text-gray-900 dark:text-white group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">
                                        New Practice Session
                                    </div>
                                    <div className="text-xs text-gray-500">Load a YouTube video</div>
                                </div>
                                <ArrowRight size={18} className="text-gray-400 group-hover:text-yellow-500 transition-colors" />
                            </button>

                            <button
                                onClick={() => onNavigate('flashcards')}
                                className="w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl hover:border-blue-500/50 hover:shadow-md transition-all group"
                            >
                                <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                                    <Layers size={20} className="text-white" />
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        Review Flashcards
                                    </div>
                                    <div className="text-xs text-gray-500">{savedCardsCount} cards saved</div>
                                </div>
                                <ArrowRight size={18} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                            </button>

                            <button
                                onClick={() => onNavigate('vocab')}
                                className="w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl hover:border-green-500/50 hover:shadow-md transition-all group"
                            >
                                <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center">
                                    <BookOpen size={20} className="text-white" />
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="font-semibold text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                                        My Words
                                    </div>
                                    <div className="text-xs text-gray-500">Manage vocabulary</div>
                                </div>
                                <ArrowRight size={18} className="text-gray-400 group-hover:text-green-500 transition-colors" />
                            </button>

                            <button
                                onClick={() => onNavigate('learning')}
                                className="w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl hover:border-purple-500/50 hover:shadow-md transition-all group"
                            >
                                <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center">
                                    <TrendingUp size={20} className="text-white" />
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                        Browse Lessons
                                    </div>
                                    <div className="text-xs text-gray-500">Structured learning</div>
                                </div>
                                <ArrowRight size={18} className="text-gray-400 group-hover:text-purple-500 transition-colors" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
