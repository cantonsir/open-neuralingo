import React, { useState, useEffect } from 'react';
import {
    Play,
    PlayCircle,
    BookOpen,
    Clock,
    Flame,
    ArrowRight,
    Layers,
    TrendingUp
} from 'lucide-react';
import { api, HistoryItem } from '../../db';
import CommonDashboard from '../common/CommonDashboard';
import { View } from '../../types';

interface DashboardViewProps {
    onPlayVideo: (videoId: string) => void;
    onNavigate: (view: View) => void;
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
            // In a real app, we might check if this component is still mounted
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

    // --- Content Renderers ---

    const recentVideos = (
        <>
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
        </>
    );

    const quickActions = (
        <>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Layers size={18} className="text-gray-400" />
                Quick Actions
            </h3>
            <div className="space-y-3">
                <button
                    onClick={() => onNavigate('compose')}
                    className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-200 dark:border-yellow-800/30 rounded-xl hover:from-yellow-500/20 hover:to-orange-500/20 transition-all group"
                >
                    <div className="w-10 h-10 rounded-lg bg-yellow-500 flex items-center justify-center">
                        <PlayCircle size={20} className="text-white" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="font-semibold text-gray-900 dark:text-white group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">
                            Generate Audio
                        </div>
                        <div className="text-xs text-gray-500">AI-generated discussions</div>
                    </div>
                    <ArrowRight size={18} className="text-gray-400 group-hover:text-yellow-500 transition-colors" />
                </button>

                <button
                    onClick={() => onNavigate('loop')}
                    className="w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl hover:border-yellow-500/50 hover:shadow-md transition-all group"
                >
                    <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                        <PlayCircle size={20} className="text-white" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="font-semibold text-gray-900 dark:text-white group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">
                            YouTube Practice
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
        </>
    );

    return (
        <CommonDashboard
            title={`${getGreeting()}! 👋`}
            subtitle="Ready to sharpen your listening skills today?"
            onStartAction={() => onNavigate('compose')}
            startActionLabel="Generate Audio"
            stats={[
                { icon: <Play size={20} fill="currentColor" />, label: "Videos", value: history.length || mockStats.videosWatched, subtext: "Total practiced", color: "purple" },
                { icon: <BookOpen size={20} />, label: "Words", value: savedCardsCount || mockStats.wordsLearned, subtext: "Saved to deck", color: "blue" },
                { icon: <Clock size={20} />, label: "Time", value: `${mockStats.practiceHours}h`, subtext: "This week", color: "green" },
                { icon: <Flame size={20} />, label: "Streak", value: mockStats.dayStreak, subtext: "Day streak 🔥", color: "orange" },
            ]}
            recentItems={recentVideos}
            quickActions={quickActions}
            colorTheme="orange"
        />
    );
}
