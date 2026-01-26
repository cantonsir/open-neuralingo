import React, { useState } from 'react';
import { Book, Loader2, RefreshCw, Send, Sparkles } from 'lucide-react';
import { generateStory } from '../../ai';

export default function ReadingView() {
    const [topic, setTopic] = useState('');
    const [level, setLevel] = useState('intermediate');
    const [isGenerating, setIsGenerating] = useState(false);
    const [story, setStory] = useState<{ title: string; content: string } | null>(null);

    const handleGenerate = async () => {
        if (!topic.trim()) return;

        setIsGenerating(true);
        setStory(null);
        try {
            const result = await generateStory(topic, level);
            if (result) {
                setStory(result);
            }
        } catch (error) {
            console.error("Failed to generate story", error);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-hidden">
            {/* Header / Input Area */}
            <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-6 shadow-sm z-10">
                <div className="max-w-3xl mx-auto flex flex-col gap-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                            <Book size={20} />
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Reading Practice</h1>
                    </div>

                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="Enter a topic (e.g., Space Travel, Cooking, History of Jazz)..."
                            className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-gray-900 dark:text-gray-100"
                            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                        />

                        <select
                            value={level}
                            onChange={(e) => setLevel(e.target.value)}
                            className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-gray-900 dark:text-gray-100"
                        >
                            <option value="beginner">Beginner</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="advanced">Advanced</option>
                        </select>

                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !topic.trim()}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                        >
                            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                            Generate
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content / Story Display */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-3xl mx-auto">
                    {isGenerating ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-4">
                            <Loader2 size={32} className="animate-spin text-blue-500" />
                            <p>Crafting your story...</p>
                        </div>
                    ) : story ? (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-gray-700 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-3xl font-serif font-bold text-gray-900 dark:text-white mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
                                {story.title}
                            </h2>
                            <div className="prose dark:prose-invert max-w-none text-lg leading-relaxed text-gray-700 dark:text-gray-300 font-serif">
                                {story.content.split('\n').map((paragraph, idx) => (
                                    <p key={idx} className="mb-4">
                                        {paragraph}
                                    </p>
                                ))}
                            </div>

                            <div className="mt-8 flex justify-end">
                                <button
                                    onClick={handleGenerate}
                                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors"
                                >
                                    <RefreshCw size={14} />
                                    Regenerate
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 mt-20">
                            <Book size={48} className="text-gray-200 dark:text-gray-800 mb-4" />
                            <p className="text-lg">Enter a topic to generate a custom story.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
