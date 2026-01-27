import React from 'react';
import { Mic, Layers, TrendingUp, Clock, Flame, MessageSquare } from 'lucide-react';
import CommonDashboard from '../common/CommonDashboard';
import { View } from '../../types';

interface SpeakingDashboardProps {
    setView: (view: View) => void;
    setSpeakingData: (data: any) => void;
}

export default function SpeakingDashboard({ setView, setSpeakingData }: SpeakingDashboardProps) {
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
                            Start Roleplay
                        </div>
                        <div className="text-xs text-gray-500">Choose a scenario</div>
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
                { icon: <MessageSquare size={20} />, label: "Chats", value: 12, subtext: "Total sessions", color: "green" },
                { icon: <Clock size={20} />, label: "Spoken", value: "45m", subtext: "This week", color: "blue" },
                { icon: <Flame size={20} />, label: "Streak", value: 2, subtext: "Day streak", color: "orange" },
            ]}
            recentItems={<div className="text-center py-8 text-gray-500">Recent conversations will appear here.</div>}
            quickActions={quickActions}
            colorTheme="green"
        />
    );
}
