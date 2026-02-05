import React, { useState, useEffect } from 'react';
import { Mic, Layers, TrendingUp, Clock, Flame, MessageSquare } from 'lucide-react';
import CommonDashboard from '../common/CommonDashboard';
import { View } from '../../types';
import { api } from '../../db';

interface SpeakingDashboardProps {
    setView: (view: View) => void;
    setSpeakingData: (data: any) => void;
}

export default function SpeakingDashboard({ setView, setSpeakingData }: SpeakingDashboardProps) {
    const [stats, setStats] = useState({
        chats: 0,
        spokenTime: 0,
        dayStreak: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.fetchSpeakingSessions().then(data => {
            // Calculate Stats
            const totalDuration = data.reduce((acc: number, session: any) => acc + (session.durationSeconds || 0), 0);
            const spokenTime = parseFloat((totalDuration / 60).toFixed(1)); // Minutes

            // Calculate Streak
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
                chats: data.length,
                spokenTime,
                dayStreak: streak
            });
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

            // Calculate total duration for this day (minutes)
            const durationMinutes = dayItems.reduce((acc, session) => {
                return acc + (session.durationSeconds || 0);
            }, 0) / 60;

            data.push({
                label: dayLabel,
                value: Math.round(durationMinutes)
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
                    onClick={() => setView('scenario')}
                    className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-200 dark:border-green-800/30 rounded-xl hover:from-green-500/20 hover:to-emerald-500/20 transition-all group"
                >
                    <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center">
                        <Mic size={20} className="text-white" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="font-semibold text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                            Conversation
                        </div>
                        <div className="text-xs text-gray-500">Start a conversation</div>
                    </div>
                </button>

                <button
                    onClick={() => setView('learning')}
                    className="w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl hover:border-emerald-500/50 hover:shadow-md transition-all group"
                >
                    <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                        <TrendingUp size={20} className="text-white" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="font-semibold text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            Drills
                        </div>
                        <div className="text-xs text-gray-500">Pronunciation practice</div>
                    </div>
                </button>
            </div>
        </>
    );

    return (
        <CommonDashboard
            title="Speaking Studio"
            subtitle="Practice conversation and pronunciation."
            onStartAction={() => setView('scenario')}
            startActionLabel="New Session"
            stats={[
                { icon: <MessageSquare size={20} />, label: "Chats", value: stats.chats, subtext: "Total sessions", color: "green" },
                { icon: <Clock size={20} />, label: "Spoken", value: `${stats.spokenTime}m`, subtext: "Total time", color: "blue" },
                { icon: <Flame size={20} />, label: "Streak", value: stats.dayStreak, subtext: "Day streak", color: "orange" },
            ]}
            weeklyData={getWeeklyData()}
            recentItems={<div className="text-center py-8 text-gray-500">Recent conversations will appear here.</div>}
            quickActions={quickActions}
            colorTheme="green"
        />
    );
}
