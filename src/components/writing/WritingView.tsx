import React, { useState } from 'react';
import { PenTool, Check, ArrowRight, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { correctWriting } from '../../ai';

export default function WritingView() {
    const [text, setText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [mode, setMode] = useState<'grammar' | 'polish'>('grammar');

    const handleAction = async () => {
        if (!text.trim()) return;

        setIsProcessing(true);
        setResult(null);

        try {
            const instruction = mode === 'grammar'
                ? "Fix grammar and spelling errors, maintaining the original meaning"
                : "Rewrite to sound more native, professional, and fluent";

            const response = await correctWriting(text, instruction);
            if (response) {
                setResult(response);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-hidden">
            {/* Header */}
            <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-6 shadow-sm z-10">
                <div className="max-w-4xl mx-auto flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                            <PenTool size={20} />
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Writing Assistant</h1>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setMode('grammar')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2
                                ${mode === 'grammar'
                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }
                            `}
                        >
                            <Check size={16} />
                            Grammar Check
                        </button>
                        <button
                            onClick={() => setMode('polish')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2
                                ${mode === 'polish'
                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }
                            `}
                        >
                            <Wand2 size={16} />
                            Polish & Enhance
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Split View */}
            <div className="flex-1 overflow-hidden">
                <div className="h-full max-w-6xl mx-auto flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-800">

                    {/* Input Side */}
                    <div className="flex-1 flex flex-col p-6 min-h-[50%] md:min-h-0">
                        <label className="text-sm font-medium text-gray-500 mb-2">Original Text</label>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Type or paste your text here..."
                            className="flex-1 w-full bg-white dark:bg-gray-800 border-0 rounded-xl p-4 shadow-sm resize-none focus:ring-2 focus:ring-purple-500/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 text-lg leading-relaxed"
                            autoFocus
                        />
                        <div className="mt-4 flex justify-end">
                            <button
                                onClick={handleAction}
                                disabled={isProcessing || !text.trim()}
                                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
                            >
                                {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                                {mode === 'grammar' ? 'Fix Errors' : 'Improve Writing'}
                            </button>
                        </div>
                    </div>

                    {/* Output Side */}
                    <div className="flex-1 flex flex-col p-6 bg-gray-50/50 dark:bg-gray-950/50 min-h-[50%] md:min-h-0">
                        <label className="text-sm font-medium text-gray-500 mb-2">AI Feedback</label>
                        {result ? (
                            <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 overflow-y-auto animate-in fade-in duration-500">
                                <div className="prose dark:prose-invert max-w-none">
                                    {/* Use a dirty markdown renderer or just pre-wrap */}
                                    <div className="whitespace-pre-wrap">{result}</div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                                <ArrowRight size={32} className="mb-2 text-gray-300 dark:text-gray-700" />
                                <p>Results will appear here</p>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}
