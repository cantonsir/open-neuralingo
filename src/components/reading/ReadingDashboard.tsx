import React, { useState, useEffect } from 'react';
import { Book, Play, Layers, TrendingUp, BookOpen, Clock, Flame, Globe, BarChart3, ClipboardCheck } from 'lucide-react';
import CommonDashboard from '../common/CommonDashboard';
import { View } from '../../types';

import { api } from '../../db';

interface ReadingDashboardProps {
    onNavigate: (view: View) => void;
}

export default function ReadingDashboard({ onNavigate }: ReadingDashboardProps) {
    const [stats, setStats] = useState({
        textsRead: 0,
        wordsRead: 0,
        dayStreak: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.fetchReadingSessions().then(data => {
            // Calculate Stats
            const wordsRead = data.reduce((acc: number, session: any) => {
                const words = session.content ? session.content.trim().split(/\s+/).length : 0;
                return acc + words;
            }, 0);

            // Calculate Streak
            // Assuming reading sessions have createdAt
            const sortedDates = data
                .map((session: any) => new Date(session.createdAt).setHours(0, 0, 0, 0))
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
                textsRead: data.length,
                wordsRead,
                dayStreak: streak
            });
            // Store sessions for weekly data calculation
            // We need state for sessions if we want to filter them later, or calculate weekly data inside the effect
            // Actually, getWeeklyData cannot access 'data' variable if defined outside.
            // Let's store sessions in state.
            setSessions(data);
            setLoading(false);
        });
    }, []);

    const [sessions, setSessions] = useState<any[]>([]);

    // Helper to generate last 7 days data
    const getWeeklyData = () => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const data = [];
        const today = new Date();

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dayLabel = days[date.getDay()];

            // Filter sessions for this day
            const dayStart = new Date(date.setHours(0, 0, 0, 0)).getTime();
            const dayEnd = new Date(date.setHours(23, 59, 59, 999)).getTime();

            const dayItems = sessions.filter(session => {
                const created = new Date(session.createdAt).getTime();
                return created >= dayStart && created <= dayEnd;
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
            <div className="space-y-3 mb-8">
                <button
                    onClick={() => onNavigate('compose')}
                    className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-200 dark:border-blue-800/30 rounded-xl hover:from-blue-500/20 hover:to-indigo-500/20 transition-all group"
                >
                    <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                        <Book size={20} className="text-white" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            Generate Reading
                        </div>
                        <div className="text-xs text-gray-500">Create reading materials</div>
                    </div>
                </button>

                <button
                    onClick={() => onNavigate('learning')}
                    className="w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl hover:border-indigo-500/50 hover:shadow-md transition-all group"
                >
                    <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center">
                        <TrendingUp size={20} className="text-white" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            Lessons
                        </div>
                        <div className="text-xs text-gray-500">Grammar & Vocab</div>
                    </div>
                </button>

                <button
                    onClick={() => onNavigate('assessment')}
                    className="w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl hover:border-green-500/50 hover:shadow-md transition-all group"
                >
                    <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center">
                        <ClipboardCheck size={20} className="text-white" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="font-semibold text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                            Assessment
                        </div>
                        <div className="text-xs text-gray-500">Test your reading level</div>
                    </div>
                </button>

                <button
                    onClick={() => onNavigate('statistics')}
                    className="w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl hover:border-purple-500/50 hover:shadow-md transition-all group"
                >
                    <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center">
                        <BarChart3 size={20} className="text-white" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                            Statistics
                        </div>
                        <div className="text-xs text-gray-500">View progress & history</div>
                    </div>
                </button>
            </div>

            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Layers size={18} className="text-gray-400" />
                Tools
            </h3>
            <div className="space-y-3">
                <button
                    onClick={() => onNavigate('webpage')}
                    className="w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl hover:border-indigo-500/50 hover:shadow-md transition-all group"
                >
                    <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center">
                        <Globe size={20} className="text-white" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            Online Webpage
                        </div>
                        <div className="text-xs text-gray-500">Browse embedded websites</div>
                    </div>
                </button>
            </div>
        </>
    );

    return (
        <CommonDashboard
            title="Reading Practice"
            subtitle="Improve your comprehension skills."
            onStartAction={() => onNavigate('compose')}
            startActionLabel="Generate Reading"
            stats={[
                { icon: <BookOpen size={20} />, label: "Read", value: stats.textsRead, subtext: "Texts finished", color: "blue" },
                { icon: <Clock size={20} />, label: "Words", value: stats.wordsRead, subtext: "Total words", color: "green" },
                { icon: <Flame size={20} />, label: "Streak", value: stats.dayStreak, subtext: "Day streak", color: "orange" },
            ]}
            weeklyData={getWeeklyData()}
            recentItems={<div className="text-center py-8 text-gray-500">Recent texts will appear here.</div>}
            quickActions={quickActions}
            colorTheme="blue"
        />
    );
}
