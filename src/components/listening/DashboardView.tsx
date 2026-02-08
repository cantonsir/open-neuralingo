import React, { useState, useEffect } from 'react';
import {
    Play,
    PlayCircle,
    BookOpen,
    Clock,
    Flame,
    ArrowRight,
    Layers,
    TrendingUp,
    X
} from 'lucide-react';
import { api, HistoryItem } from '../../db';
import CommonDashboard from '../common/CommonDashboard';
import { View } from '../../types';
import { formatTimeAgo } from '../../utils/formatters';

interface DashboardViewProps {
    onPlayVideo: (videoId: string) => void;
    onNavigate: (view: View) => void;
    savedCardsCount: number;
    markersCount: number;
}

export default function DashboardView({
    onPlayVideo,
    onNavigate,
    savedCardsCount,
    markersCount
}: DashboardViewProps) {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
    const [stats, setStats] = useState({
        videosWatched: 0,
        wordsLearned: 0,
        practiceHours: 0,
        dayStreak: 0
    });

    const computeStats = (historyData: HistoryItem[]) => {
        const totalSeconds = historyData.reduce((acc, item) => {
            if (item.duration) {
                const parts = item.duration.split(':').map(Number);
                let seconds = 0;
                if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
                return acc + seconds;
            }
            return acc + 300;
        }, 0);
        const practiceHours = parseFloat((totalSeconds / 3600).toFixed(1));

        const sortedDates = historyData
            .map(item => new Date(item.watchedAt).setHours(0, 0, 0, 0))
            .sort((a, b) => b - a);
        const uniqueDays = [...new Set(sortedDates)];

        let streak = 0;
        const today = new Date().setHours(0, 0, 0, 0);
        const yesterday = today - 86400000;

        if (uniqueDays.length > 0) {
            if (uniqueDays[0] === today) {
                streak = 1;
                for (let i = 1; i < uniqueDays.length; i++) {
                    if (uniqueDays[i] === today - (i * 86400000)) streak++;
                    else break;
                }
            } else if (uniqueDays[0] === yesterday) {
                streak = 1;
                for (let i = 1; i < uniqueDays.length; i++) {
                    if (uniqueDays[i] === yesterday - (i * 86400000)) streak++;
                    else break;
                }
            }
        }

        return {
            videosWatched: historyData.length,
            wordsLearned: 0,
            practiceHours,
            dayStreak: streak
        };
    };

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const historyData = await api.fetchHistory();
                setHistory(historyData);
                setStats(computeStats(historyData));

                setLoading(false);
            } catch (error) {
                console.error("Failed to load dashboard data", error);
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const handleDeleteRecent = async (videoId: string) => {
        try {
            setDeletingVideoId(videoId);
            await api.deleteFromHistory(videoId);
            setHistory(prev => {
                const next = prev.filter(item => item.videoId !== videoId);
                setStats(computeStats(next));
                return next;
            });
        } catch (error) {
            console.error('Failed to delete recent video:', error);
        } finally {
            setDeletingVideoId(null);
        }
    };

    // Helper to generate last 7 days data
    const getWeeklyData = () => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const data = [];
        const today = new Date();

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dayLabel = days[date.getDay()];

            // Filter history for this day
            const dayStart = new Date(date.setHours(0, 0, 0, 0)).getTime();
            const dayEnd = new Date(date.setHours(23, 59, 59, 999)).getTime();

            const dayItems = history.filter(item => {
                const w = item.watchedAt;
                return w >= dayStart && w <= dayEnd;
            });

            // Calculate total duration for this day (in minutes)
            const durationMinutes = dayItems.reduce((acc, item) => {
                if (item.duration) {
                    const parts = item.duration.split(':').map(Number);
                    let seconds = 0;
                    if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                    else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
                    return acc + seconds;
                }
                return acc + 300; // 5 min fallback
            }, 0) / 60;

            data.push({
                label: dayLabel,
                value: Math.round(durationMinutes)
            });
        }
        return data;
    };

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
                    <button
                        onClick={() => onNavigate('history')}
                        className="text-sm text-yellow-600 hover:text-yellow-700 font-medium flex items-center gap-1"
                    >
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
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteRecent(item.videoId);
                                    }}
                                    disabled={deletingVideoId !== null}
                                    className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-black/60 hover:bg-red-500 disabled:hover:bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all disabled:opacity-100"
                                    title="Remove from recent videos"
                                >
                                    <X size={12} className="text-white" />
                                </button>
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
                { icon: <Play size={20} fill="currentColor" />, label: "Videos", value: stats.videosWatched, subtext: "Total practiced", color: "purple" },
                { icon: <BookOpen size={20} />, label: "Words", value: savedCardsCount, subtext: "Saved to deck", color: "blue" },
                { icon: <Clock size={20} />, label: "Time", value: `${stats.practiceHours}h`, subtext: "Total time", color: "green" },
                { icon: <Flame size={20} />, label: "Streak", value: stats.dayStreak, subtext: "Day streak 🔥", color: "orange" },
            ]}
            weeklyData={getWeeklyData()}
            recentItems={recentVideos}
            quickActions={quickActions}
            colorTheme="orange"
        />
    );
}
