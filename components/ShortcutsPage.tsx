import React from 'react';
import { ArrowLeft, MessageSquare, Play, SkipBack, SkipForward, Eye } from 'lucide-react';

interface ShortcutsPageProps {
    onBack: () => void;
}

const ShortcutsPage: React.FC<ShortcutsPageProps> = ({ onBack }) => {
    return (
        <div className="flex-1 bg-gray-50 dark:bg-[#0f1117] p-8 overflow-y-auto flex flex-col items-center justify-center">
            <div className="max-w-4xl w-full space-y-8">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Keyboard Shortcuts</h1>
                    <p className="text-gray-500 dark:text-gray-400">Master the controls to practice more efficiently.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Review & Interaction */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-6 text-yellow-500 font-semibold text-lg">
                            <MessageSquare size={20} fill="currentColor" />
                            <span>Review & Interaction</span>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-start gap-4">
                                <kbd className="min-w-[4rem] h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md text-sm font-bold text-gray-700 dark:text-gray-300 shadow-[0_2px_0_theme(colors.gray.200)] dark:shadow-[0_2px_0_theme(colors.gray.700)]">
                                    Space
                                </kbd>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1">Mark confusion point</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                                        Instantly marks the current timestamp as a review point. Use this when you encounter a phrase or word you don't understand.
                                    </p>
                                </div>
                            </div>

                            <div className="h-px bg-gray-100 dark:bg-gray-700/50" />

                            <div className="flex items-start gap-4">
                                <kbd className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md text-sm font-bold text-gray-700 dark:text-gray-300 shadow-[0_2px_0_theme(colors.gray.200)] dark:shadow-[0_2px_0_theme(colors.gray.700)]">
                                    S
                                </kbd>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1">Reveal Subtitle</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                                        Temporarily reveals the blurred subtitle content. You can also hover over the subtitle region with your mouse.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Playback Control */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-6 text-blue-500 font-semibold text-lg">
                            <Play size={20} fill="currentColor" />
                            <span>Playback Control</span>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Play / Pause</span>
                                <kbd className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md text-xs font-bold text-gray-500 dark:text-gray-400">K</kbd>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Last Sentence</span>
                                <kbd className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md text-xs font-bold text-gray-500 dark:text-gray-400">←</kbd>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Next Sentence</span>
                                <kbd className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md text-xs font-bold text-gray-500 dark:text-gray-400">→</kbd>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-center pt-8">
                    <button
                        onClick={onBack}
                        className="bg-yellow-500 hover:bg-yellow-400 text-black px-6 py-3.5 rounded-lg font-bold transition-all transform hover:scale-105 shadow-lg hover:shadow-yellow-500/25 flex items-center gap-2"
                    >
                        <ArrowLeft size={18} />
                        Return to Practice
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ShortcutsPage;
