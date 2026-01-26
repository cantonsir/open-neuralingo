import React from 'react';
import { Book, Layers, Sparkles, BookOpen, Star, Clock } from 'lucide-react';
import CommonDashboard from '../common/CommonDashboard';
import { View } from '../../types';

export default function ReadingDashboard({
    onNavigate,
    savedStoriesCount = 0
}: {
    onNavigate: (view: View) => void;
    savedStoriesCount?: number;
}) {
    // Mock actions
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
                        <Sparkles size={20} className="text-white" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            Generate New Story
                        </div>
                        <div className="text-xs text-gray-500">AI-powered stories</div>
                    </div>
                </button>
            </div>
        </>
    );

    const recentStories = (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-8 text-center">
            <div className="text-4xl mb-3">📚</div>
            <p className="text-gray-500 dark:text-gray-400">No stories read yet. Start generating!</p>
        </div>
    );

    return (
        <CommonDashboard
            title="Reading Dashboard"
            subtitle="Explore new worlds through text."
            stats={[
                { icon: <BookOpen size={20} />, label: "Read", value: 0, subtext: "Stories completed", color: "blue" },
                { icon: <Star size={20} />, label: "Vocab", value: 0, subtext: "New words found", color: "purple" },
                { icon: <Clock size={20} />, label: "Time", value: "0h", subtext: "Reading time", color: "green" },
                { icon: <Layers size={20} />, label: "Saved", value: savedStoriesCount, subtext: "In library", color: "orange" },
            ]}
            onStartAction={() => onNavigate('generator')}
            startActionLabel="Generate Story"
            recentItems={
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Clock size={18} className="text-gray-400" />
                        Recent Stories
                    </h3>
                    {recentStories}
                </div>
            }
            quickActions={quickActions}
            colorTheme="blue"
        />
    );
}
