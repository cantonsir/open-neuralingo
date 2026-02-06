import React, { useEffect, useState } from 'react';
import { PenTool, Layers, TrendingUp, Clock, Flame, FileText, ChevronRight } from 'lucide-react';
import CommonDashboard from '../common/CommonDashboard';
import { View } from '../../types';
import { api } from '../../db';

interface WritingDashboardProps {
    setView: (view: View) => void;
    setWritingData: (data: any) => void;
}

export default function WritingDashboard({ setView, setWritingData }: WritingDashboardProps) {
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalTexts: 0,
        totalWords: 0,
        dayStreak: 0
    });

    useEffect(() => {
        api.fetchWritingSessions().then(data => {
            setSessions(data);

            // Calculate Stats
            const totalWords = data.reduce((acc: number, session: any) => {
                const words = session.content ? session.content.trim().split(/\s+/).length : 0;
                return acc + words;
            }, 0);

            // Calculate Streak
            const sortedDates = data
                .map((session: any) => new Date(session.createdAt || session.updatedAt).setHours(0, 0, 0, 0))
                .sort((a: number, b: number) => b - a);

            const uniqueDays = [...new Set(sortedDates)];
            let streak = 0;
            const today = new Date().setHours(0, 0, 0, 0);
            const yesterday = today - 86400000;

            if (uniqueDays.length > 0) {
                if (uniqueDays[0] === today) {
                    streak = 1;
                    for (let i = 1; i < uniqueDays.length; i++) {
                        if (uniqueDays[i] === today - (i * 86400000)) {
                            streak++;
                        } else {
                            break;
                        }
                    }
                } else if (uniqueDays[0] === yesterday) {
                    streak = 1;
                    for (let i = 1; i < uniqueDays.length; i++) {
                        if (uniqueDays[i] === yesterday - (i * 86400000)) {
                            streak++;
                        } else {
                            break;
                        }
                    }
                }
            }

            setStats({
                totalTexts: data.length,
                totalWords,
                dayStreak: streak
            });

            setLoading(false);
        });
    }, []);

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

            const dayItems = sessions.filter(session => {
                const updated = new Date(session.createdAt || session.updatedAt).getTime();
                return updated >= dayStart && updated <= dayEnd;
            });

            // Calculate total words for this day
            const dailyWords = dayItems.reduce((acc, session) => {
                const words = session.content ? session.content.trim().split(/\s+/).length : 0;
                return acc + words;
            }, 0);

            data.push({
                label: dayLabel,
                value: dailyWords
            });
        }
        return data;
    };


    const quickActions = (
        <>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Layers size={18} className="text-gray-400" />
                Quick Actions
            </h3>
            <div className="space-y-3">
                <button
                    onClick={() => setView('compose')}
                    className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-200 dark:border-purple-800/30 rounded-xl hover:from-purple-500/20 hover:to-pink-500/20 transition-all group"
                >
                    <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center">
                        <PenTool size={20} className="text-white" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                            New Composition
                        </div>
                        <div className="text-xs text-gray-500">Write with AI feedback</div>
                    </div>
                </button>

                <button
                    onClick={() => setView('learning')}
                    className="w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl hover:border-pink-500/50 hover:shadow-md transition-all group"
                >
                    <div className="w-10 h-10 rounded-lg bg-pink-500 flex items-center justify-center">
                        <TrendingUp size={20} className="text-white" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="font-semibold text-gray-900 dark:text-white group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                            Writing Drills
                        </div>
                        <div className="text-xs text-gray-500">Quick exercises</div>
                    </div>
                </button>
            </div>
        </>
    );

    const recentItems = (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recent Writings</h3>
                <button className="text-sm text-purple-600 hover:text-purple-700 font-medium">View All</button>
            </div>

            {loading ? (
                <div className="text-center py-8 text-gray-500">Loading history...</div>
            ) : sessions.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p>No writings yet. Start your first composition!</p>
                </div>
            ) : (
                <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2">
                    {sessions.map(session => (
                        <button
                            key={session.id}
                            onClick={() => {
                                setWritingData({
                                    id: session.id,
                                    topic: session.topic,
                                    contextId: session.contextId,
                                    content: session.content
                                });
                                setView('writer');
                            }}
                            className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-xl hover:border-purple-200 dark:hover:border-purple-700 hover:shadow-sm transition-all text-left group"
                        >
                            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 group-hover:bg-purple-50 group-hover:text-purple-600 transition-colors">
                                <FileText size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-purple-600 transition-colors">
                                    {session.topic}
                                </h4>
                                <p className="text-xs text-gray-500 truncate">
                                    {new Date(session.updatedAt || session.createdAt).toLocaleDateString()} • {session.content?.length || 0} chars
                                </p>
                            </div>
                            <ChevronRight size={16} className="text-gray-400 group-hover:text-purple-400" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <CommonDashboard
            title="Writing Studio"
            subtitle="Enhance your writing style."
            onStartAction={() => setView('compose')}
            startActionLabel="Write Now"
            stats={[
                { icon: <FileText size={20} />, label: "Texts", value: stats.totalTexts, subtext: "Total written", color: "purple" },
                { icon: <Clock size={20} />, label: "Words", value: stats.totalWords, subtext: "Total words", color: "blue" },
                { icon: <Flame size={20} />, label: "Streak", value: stats.dayStreak, subtext: "Day streak", color: "orange" },
            ]}
            weeklyData={getWeeklyData()}
            recentItems={recentItems}
            quickActions={quickActions}
            colorTheme="purple"
        />
    );
}
