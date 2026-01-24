import React, { useState } from 'react';
import { Search, Download, ArrowRight, Zap } from 'lucide-react';

interface HomeViewProps {
    inputUrl: string;
    setInputUrl: (url: string) => void;
    onFetchSubtitles: (videoId: string) => void;
    onManualSubmit: (videoId: string, subs: string) => void;
    isFetchingSubs: boolean;
}

export default function HomeView({
    inputUrl,
    setInputUrl,
    onFetchSubtitles,
    onManualSubmit,
    isFetchingSubs,
}: HomeViewProps) {
    const [showManual, setShowManual] = useState(false);
    const [manualSubs, setManualSubs] = useState('');

    const extractVideoId = (url: string): string | null => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return match && match[2].length === 11 ? match[2] : null;
    };

    const handleAutoFetch = () => {
        const id = extractVideoId(inputUrl);
        if (id) {
            onFetchSubtitles(id);
        } else {
            alert('Please enter a valid YouTube URL');
        }
    };

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const id = extractVideoId(inputUrl);
        if (id) {
            onManualSubmit(id, manualSubs);
        } else {
            alert('Invalid YouTube URL');
        }
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
            {/* Hero Section */}
            <div className="max-w-2xl w-full text-center mb-12">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-sm font-medium mb-6">
                    <Zap size={16} fill="currentColor" />
                    Master listening through practice
                </div>

                <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
                    Train Your Ears with
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-orange-500"> YouTube</span>
                </h1>

                <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
                    Loop sentences, mark difficult words, and build vocabulary from your favorite videos.
                </p>
            </div>

            {/* URL Input Card */}
            <div className="max-w-xl w-full">
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-xl shadow-gray-200/50 dark:shadow-none">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                        YouTube Video URL
                    </label>

                    <div className="relative mb-4">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            value={inputUrl}
                            onChange={(e) => setInputUrl(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl py-4 pl-12 pr-4 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all"
                            placeholder="https://youtube.com/watch?v=..."
                            autoFocus
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={handleAutoFetch}
                            disabled={isFetchingSubs || !inputUrl.trim()}
                            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg shadow-yellow-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                            {isFetchingSubs ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Fetching...
                                </>
                            ) : (
                                <>
                                    <Download size={20} />
                                    Auto-Fetch Subtitles
                                </>
                            )}
                        </button>
                    </div>

                    <div className="mt-4 text-center">
                        <button
                            onClick={() => setShowManual(!showManual)}
                            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline underline-offset-2 transition-colors"
                        >
                            {showManual ? 'Hide manual options' : 'Enter subtitles manually'}
                        </button>
                    </div>

                    {showManual && (
                        <form onSubmit={handleManualSubmit} className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-2 duration-200">
                            <textarea
                                value={manualSubs}
                                onChange={(e) => setManualSubs(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm font-mono text-gray-900 dark:text-gray-300 h-32 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 resize-none transition-all"
                                placeholder="Paste WebVTT or SRT content here..."
                            />
                            <button
                                type="submit"
                                className="mt-3 w-full flex items-center justify-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold py-3 px-6 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
                            >
                                Start Practice <ArrowRight size={18} />
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
