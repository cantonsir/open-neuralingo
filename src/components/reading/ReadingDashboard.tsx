import React from 'react';
import { Book, Play, Layers, TrendingUp, BookOpen, Clock, Flame } from 'lucide-react';
import CommonDashboard from '../common/CommonDashboard';
import { View } from '../../types';

interface ReadingDashboardProps {
    onNavigate: (view: View) => void;
}

export default function ReadingDashboard({ onNavigate }: ReadingDashboardProps) {
    const quickActions = (
        <>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Layers size={18} className="text-gray-400" />
                Quick Actions
            </h3>
            <div className="space-y-3">
                <button
                    onClick={() => onNavigate('generator')}
                    className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-200 dark:border-blue-800/30 rounded-xl hover:from-blue-500/20 hover:to-indigo-500/20 transition-all group"
                >
                    <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                        <Book size={20} className="text-white" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            Story Generator
                        </div>
                        <div className="text-xs text-gray-500">Create new stories</div>
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
            </div>
        </>
    );

    return (
        <CommonDashboard
            title="Reading Practice"
            subtitle="Improve your comprehension skills."
            onStartAction={() => onNavigate('generator')}
            startActionLabel="New Story"
            stats={[
                { icon: <BookOpen size={20} />, label: "Books", value: 5, subtext: "In library", color: "blue" },
                { icon: <Clock size={20} />, label: "Read", value: "2h", subtext: "This week", color: "green" },
                { icon: <Flame size={20} />, label: "Streak", value: 3, subtext: "Day streak", color: "orange" },
            ]}
            recentItems={<div className="text-center py-8 text-gray-500">Recent texts will appear here.</div>}
            quickActions={quickActions}
            colorTheme="blue"
        />
    );
}
