import React from 'react';
import { PenTool, Layers, CheckCircle, FileText, Clock } from 'lucide-react';
import CommonDashboard from '../common/CommonDashboard';
import { View } from '../../types';

export default function WritingDashboard({
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
                    onClick={() => onNavigate('correction')}
                    className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-200 dark:border-purple-800/30 rounded-xl hover:from-purple-500/20 hover:to-pink-500/20 transition-all group"
                >
                    <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center">
                        <PenTool size={20} className="text-white" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                            New Draft
                        </div>
                        <div className="text-xs text-gray-500">Get corrections</div>
                    </div>
                </button>
            </div>
        </>
    );

    return (
        <CommonDashboard
            title="Writing Dashboard"
            subtitle="Perfect your written expression."
            stats={[
                { icon: <FileText size={20} />, label: "Drafts", value: 0, subtext: "Texts written", color: "purple" },
                { icon: <CheckCircle size={20} />, label: "Fixes", value: 0, subtext: "Corrections loaded", color: "green" },
                { icon: <Clock size={20} />, label: "Time", value: "0m", subtext: "Writing time", color: "pink" },
                { icon: <PenTool size={20} />, label: "Style", value: "-", subtext: "Avg score", color: "orange" },
            ]}
            onStartAction={() => onNavigate('correction')}
            startActionLabel="Write Something"
            recentItems={
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-8 text-center">
                    <div className="text-4xl mb-3">📝</div>
                    <p className="text-gray-500 dark:text-gray-400">No writing drafts yet.</p>
                </div>
            }
            quickActions={quickActions}
            colorTheme="purple"
        />
    );
}
