import React from 'react';
import { Mic, Layers, User, MessageCircle, Clock } from 'lucide-react';
import CommonDashboard from '../common/CommonDashboard';
import { View } from '../../types';

export default function SpeakingDashboard({
    onNavigate,
}: {
    onNavigate: (view: View) => void;
}) {
    const quickActions = (
        <>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Layers size={18} className="text-gray-400" />
                Quick Actions
            </h3>
            <div className="space-y-3">
                <button
                    onClick={() => onNavigate('scenario')}
                    className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-200 dark:border-green-800/30 rounded-xl hover:from-green-500/20 hover:to-emerald-500/20 transition-all group"
                >
                    <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center">
                        <Mic size={20} className="text-white" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="font-semibold text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                            Start Roleplay
                        </div>
                        <div className="text-xs text-gray-500">Practice conversation</div>
                    </div>
                </button>
            </div>
        </>
    );

    return (
        <CommonDashboard
            title="Speaking Dashboard"
            subtitle="Speak with confidence."
            stats={[
                { icon: <MessageCircle size={20} />, label: "Chats", value: 0, subtext: "Conversations", color: "green" },
                { icon: <Clock size={20} />, label: "Time", value: "0m", subtext: "Speaking time", color: "blue" },
                { icon: <User size={20} />, label: "Roles", value: 0, subtext: "Scenarios tried", color: "purple" },
                { icon: <Mic size={20} />, label: "Fluency", value: "-", subtext: "Avg score", color: "teal" },
            ]}
            onStartAction={() => onNavigate('scenario')}
            startActionLabel="New Scenario"
            recentItems={
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-8 text-center">
                    <div className="text-4xl mb-3">💬</div>
                    <p className="text-gray-500 dark:text-gray-400">No conversations yet.</p>
                </div>
            }
            quickActions={quickActions}
            colorTheme="green"
        />
    );
}
